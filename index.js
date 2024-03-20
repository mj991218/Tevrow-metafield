import fs from 'fs';
import path from 'path';
import util from 'util';
import dotenv from 'dotenv'

dotenv.config();

import { readCsv } from './csv.js';

const shop = process.env.shop;
const access_token = process.env.access_token;

const writeFile = util.promisify(fs.writeFile);

const getDatas = async(filename) => {
    const { results } = await readCsv(filename);
    return results.map(row => {
        const { SCENT, SCENT1, 'RRP (USD)': rrpUSD, ...rest } = row;
        return {
            ...rest,
            SCENT: [SCENT, SCENT1].filter(Boolean).join(','),
            'RRP (USD)': JSON.stringify({
                amount: parseInt(rrpUSD.replace('£','')),
                currency_code: "USD"
            })
        };
    });
}

export const writeJson = async (fileName, jsonData) => {
    const jsonString = JSON.stringify(jsonData);

    try {
        const directory = path.dirname(fileName);

        // Create the directory if it doesn't exist
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }

        await writeFile(fileName, jsonString, 'utf8');
        return true;
    } catch (err) {
        console.error(err);
        return;       
    }
}

export const graphqlRequest = async(body) => {
    const result = await fetch(shop, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token
        },
        body
    });

    return await result.json();
}

export const getSimilarProducts = async (title) => {
    const body = JSON.stringify({
        query: `
            query getSimilarProducts($query: String!) {
                products(first:3, query:$query ) {
                    nodes {
                        id
                        title
                        handle
                    }
                }
            }`,
        variables: {
            query: handlize(title)
        }
    });

    const response = await graphqlRequest(body);

    console.log(response.data.products.nodes[0], title);
    return response.data.products.nodes;
}

export const updateMetafields = async metafields => {
    const body = JSON.stringify({
        query: `
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                    metafields {
                        key
                        namespace
                        value
                    }
                    userErrors {
                        field
                        message
                        code
                    }
                }
            }`,
        variables: {
        metafields: metafields
        }
    });

    const response = await graphqlRequest(body);

    return response;
}

export const procesMetafields = async metafields => {
    const batchSize = 25;
    const numBatches = Math.ceil(metafields.length / batchSize);
    const results = [];
    for (let i = 0; i < numBatches; i++) {
        const start = i * batchSize;
        const end = start + batchSize;
        const batch = metafields.slice(start, end);
        const result = await updateMetafields(batch);
        console.log(start, end);
        results.push(result);
    }
    return results;
}

const metafieldsKey = {
    'SCENT': 'scent',
    'Primary Notes': 'primary_note',
    'Middle Notes': 'middle_notes',
    'Base Notes': 'base_notes',
    'RRP (USD)': 'rrp_100ml_'
}

const metafieldsType = {
    'SCENT': 'single_line_text_field',
    'Primary Notes': 'single_line_text_field',
    'Middle Notes': 'single_line_text_field',
    'Base Notes': 'single_line_text_field',
    'RRP (USD)': 'money'
}

const makeMetafields = (ownerId, productInfo) => {
    const metafields = [];
    for (const key in productInfo) {
        metafields.push({
            ownerId,
            namespace: "custom",
            key: metafieldsKey[key],
            type: metafieldsType[key],
            value: productInfo[key]
        })
    }
    return metafields;
}

const handlize = (str) => {
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$|-(?=-)/g, '');
}

const main = async () => {
    const productInfos = await getDatas('products.csv');
    const products = [];
    const allMetafields = [];
    const excetionProducts = [];

    for (const productInfo of productInfos) {
        const similarProducts = await getSimilarProducts(productInfo['Product Name']);
        if(similarProducts.length) {
            const product = similarProducts.find(product => {
                return product.title == productInfo['Product Name'] || product.handle == handlize(productInfo['Product Name']);
            });
            if(product) {
                products.push(product);
                const metafields = makeMetafields(product.id, productInfo);
                allMetafields.push(...metafields);
            } else {
                excetionProducts.push(productInfo);
            }
        } else {
            excetionProducts.push(productInfo);
        }
    }
    // procesMetafields(metafields);
    console.log(productInfos[6]);

    await writeJson('products.json', products);
    await writeJson('exceptionProducts.json', excetionProducts);
    await writeJson('metafields.json', allMetafields);

    const metafieldUpdates = await procesMetafields(allMetafields);
    await writeJson('metafieldUpdates.json', metafieldUpdates);
}

main();