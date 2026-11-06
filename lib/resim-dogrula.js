function validateImage(buffer, extension) {
  if (extension === '.png') {
    if (buffer.length < 45 ||
        !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        buffer.readUInt32BE(8) !== 13 || buffer.toString('ascii', 12, 16) !== 'IHDR') return false;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width > 0 && height > 0 && width <= 8192 && height <= 8192 &&
      width * height <= 40000000 && buffer.indexOf('IDAT', 33) !== -1 &&
      buffer.readUInt32BE(buffer.length - 12) === 0 &&
      buffer.toString('ascii', buffer.length - 8, buffer.length - 4) === 'IEND';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 &&
      buffer[2] === 0xff && buffer[buffer.length - 2] === 0xff &&
      buffer[buffer.length - 1] === 0xd9;
  }
  return extension === '.webp' && buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.readUInt32LE(4) === buffer.length - 8 &&
    buffer.toString('ascii', 8, 12) === 'WEBP';
}

module.exports = { validateImage };
