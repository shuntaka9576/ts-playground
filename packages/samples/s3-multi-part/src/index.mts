import {
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCopyCommand,
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const REGION = process.env.REGION!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const COMBINE_ORIGIN_S3_PREFIX = process.env.COMBINE_ORIGIN_S3_PREFIX!;
const OUTPUT_KEY = process.env.OUTPUT_KEY!;

const s3Client = new S3Client({ region: REGION });

async function getS3FilesList(prefix: string): Promise<string[]> {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });
  const response = await s3Client.send(command);

  return (
    response.Contents?.map((item) => item.Key).filter((key): key is string => {
      return key !== undefined && !key.endsWith('/');
    }) ?? []
  );
}

async function getObjectSize(key: string): Promise<number> {
  const command = new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key });
  const response = await s3Client.send(command);
  return response.ContentLength ?? 0;
}

async function combineFilesS3(files: string[], outputKey: string) {
  console.log('start combineFilesS3');

  // マルチパートアップロードの開始
  const createUploadCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: outputKey,
  });
  const createUploadResponse = await s3Client.send(createUploadCommand);

  const uploadId = createUploadResponse.UploadId!;
  const partSize = 5 * 1024 * 1024; // 5MBパート
  const partPromises = files.flatMap(async (file, index) => {
    const size = await getObjectSize(file);
    const parts = [];
    for (let startByte = 0; startByte < size; startByte += partSize) {
      const endByte = Math.min(startByte + partSize - 1, size - 1);
      const partNumber = index + 1;

      const copyCommand = new UploadPartCopyCommand({
        Bucket: BUCKET_NAME,
        Key: outputKey,
        UploadId: uploadId,
        PartNumber: partNumber,
        CopySource: `${BUCKET_NAME}/${file}`,
        CopySourceRange: `bytes=${startByte}-${endByte}`,
      });
      const copyResponse = await s3Client.send(copyCommand);
      parts.push({
        ETag: copyResponse.CopyPartResult!.ETag,
        PartNumber: partNumber,
      });
    }
    return parts;
  });

  const parts = (await Promise.all(partPromises)).flat();

  // マルチパートアップロードの完了
  const completeUploadCommand = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: outputKey,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(completeUploadCommand);
}

async function main() {
  try {
    const startTime = Date.now();

    const keys = await getS3FilesList(COMBINE_ORIGIN_S3_PREFIX);

    await combineFilesS3(keys, OUTPUT_KEY);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds

    console.log(`Upload completed in ${duration} seconds`);
    console.log(`Successfully uploaded combined file to ${OUTPUT_KEY}`);
  } catch (error) {
    console.error('Error combining files:', error);
  }
}

main().catch(console.error);
