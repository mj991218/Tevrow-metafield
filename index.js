import fs from 'fs';
import path from 'path';
import util from 'util';

import { readCsv } from './csv.js';

const writeFile = util.promisify(fs.writeFile);

const getDatas = async(filename) => {
    const { results } = await readCsv('term.csv');
    return results;
}

const access_token = process.env.access_token;

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

export const getAllProducts = async () => {
    const body = JSON.stringify({
        query: `
            query getAllProducts {
                products(first: 250) {
                    nodes {
                        id
                        templateSuffix
                    }
                }
            }`
    });

    const response = await graphqlRequest(body);

    console.log(response);
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

console.log(access_token);

const main = async () => {
    const productInfos = await getDatas('products.csv');
    console.log(productInfos[0])
}

main()