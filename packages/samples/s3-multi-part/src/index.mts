import { Readable } from 'node:stream';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const REGION = process.env.REGION!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const COMBINE_ORIGIN_S3_PREFIX = process.env.COMBINE_ORIGIN_S3_PREFIX!;
const OUTPUT_KEY = process.env.OUTPUT_KEY!;

const s3Client = new S3Client({ region: REGION });

async function getS3FilesList(prefix: string): Promise<string[]> {
  console.log(`prefix: ${prefix}`);
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  });
  const response = await s3Client.send(command);

  return (
    response.Contents?.map((item) => item.Key).filter(
      (key): key is string => key !== undefined
    ) ?? []
  );
}

async function* getFileStreams(keys: string[]) {
  console.log(`keys: ${keys}`);

  for (const key of keys) {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    console.log(`${key}: ${response}`);
    if (response.Body instanceof Readable) {
      yield response.Body;
    }
  }
}

async function uploadCombinedFile(
  streams: AsyncGenerator<Readable, void, unknown>,
  outputKey: string
) {
  console.log('start uploadCombinedFile');
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: outputKey,
      Body: Readable.from(
        (async function* () {
          for await (const stream of streams) {
            yield* stream;
          }
        })()
      ),
    },
  });

  await upload.done();
}

async function main() {
  try {
    const startTime = Date.now();

    const keys = await getS3FilesList(COMBINE_ORIGIN_S3_PREFIX);
    const fileStreams = getFileStreams(keys);

    await uploadCombinedFile(fileStreams, OUTPUT_KEY);
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds

    console.log(`Upload completed in ${duration} seconds`);
    console.log(`Successfully uploaded combined file to ${OUTPUT_KEY}`);
  } catch (error) {
    console.error('Error combining files:', error);
  }
}

main().catch(console.error);
