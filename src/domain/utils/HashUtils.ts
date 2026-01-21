import * as crypto from 'crypto';

export class HashUtils {
  static async computeHash(content: Buffer): Promise<string> {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}

