import { S3Client } from '@aws-sdk/client-s3';
import { S3Concat } from 's3-concat';

const s3Client = new S3Client({});
const srcBucketName = process.env.srcBucketName!;
const dstBucketName = process.env.dstBucketName!;
const dstPrefix = 'output';

const main = async () => {
  const s3Concat = new S3Concat({
    s3Client,
    srcBucketName: srcBucketName,
    dstBucketName: dstBucketName,
    dstPrefix,
    concatFileNameCallback: (i) => `${i}_concat.json`,
    minSize: '5GB',
  });

  await s3Concat.addFiles('tmp/1gb');
  await s3Concat.concat();
};

await main();
