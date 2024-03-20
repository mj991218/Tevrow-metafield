import fs from 'fs';
import csv from 'csv-parser';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';

export const readCsv = async (fileName) => {
  const results = [];
  const headers = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(fileName)
   .pipe(csv())
   .on('headers', (headerList) => {
      headerList.forEach(header => {
        headers.push({id: header, title: header});
      });
    })
   .on('data', (row) => {
      results.push(row);
    })
   .on('end', () => {
      console.log('CSV file successfully processed');
      resolve({headers, results});
    });
  });
}

export const writeCsv = async (fileName, headers, rows) => {
  const csvWriter = createCsvWriter({
    path: fileName,
    header: headers
  });
  
  csvWriter.writeRecords(rows)
 .then(() => {
    console.log('...Done');
  });
}