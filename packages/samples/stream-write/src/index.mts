import * as fs from 'fs';
import { DateTime } from 'luxon';

const DIST_PATH = 'dist';
const CONTENT_LENGTH = 500;
const CONTENT = `${'a'.repeat(CONTENT_LENGTH)}\n}`;
const WRITE_NUM = 5_000_000;

const main = async () => {
  if (!fs.existsSync(DIST_PATH)) {
    fs.mkdirSync(DIST_PATH);
  }

  const now = DateTime.now();
  const exportPath = `${DIST_PATH}/${now.toFormat('yyyyMMdd-HHmm')}.txt`;
  const ws = fs.createWriteStream(exportPath);

  for (let i = 0; i < WRITE_NUM; i++) {
    // --- invalid ---
    ws.write(CONTENT);
    // ---

    // --- valid ---
    // if (!ws.write(CONTENT)) {
    //   await new Promise((resolve) => ws.once('drain', resolve));
    // }
    // ---

    drawString(`${i}/${WRITE_NUM}`);
  }

  ws.end();
};

const clearCurrentLine = (): void => {
  process.stdout.write('\r\x1b[2K');
};

const drawString = (str: string): void => {
  clearCurrentLine();
  process.stdout.write(str);
};

await main();
