function patchMP4(data) {
  const view = new DataView(data);
  const len = data.byteLength;
  let pos = 0;

  while (pos + 8 <= len) {
    const boxSize = view.getUint32(pos, false);
    const boxType = String.fromCharCode(
      view.getUint8(pos+4), view.getUint8(pos+5),
      view.getUint8(pos+6), view.getUint8(pos+7)
    );
    if (boxSize < 8) break;
    if (boxType === 'moov') {
      patchMoov(data, pos, len);
      break;
    }
    pos += boxSize;
    if (boxSize === 0) break;
  }

  return data;
}

function patchMoov(data, start, len) {
  const view = new DataView(data);
  const end = start + view.getUint32(start, false);
  let pos = start + 8;

  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = view.getUint32(pos, false);
    const ty = String.fromCharCode(
      view.getUint8(pos+4), view.getUint8(pos+5),
      view.getUint8(pos+6), view.getUint8(pos+7)
    );
    if (sz < 8) break;

    if (ty === 'mvhd') {
      const ver = view.getUint8(pos + 8);
      const off = ver === 1 ? pos + 28 : pos + 20;
      if (off + 4 <= len) view.setUint32(off, 3, false);
    }

    if (ty === 'trak') patchTrak(data, pos, len);

    pos += sz;
  }
}

function patchTrak(data, start, len) {
  const view = new DataView(data);
  const end = start + view.getUint32(start, false);
  let pos = start + 8;

  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = view.getUint32(pos, false);
    const ty = String.fromCharCode(
      view.getUint8(pos+4), view.getUint8(pos+5),
      view.getUint8(pos+6), view.getUint8(pos+7)
    );
    if (sz < 8) break;
    if (ty === 'mdia') patchMdia(data, pos, len);
    pos += sz;
  }
}

function patchMdia(data, start, len) {
  const view = new DataView(data);
  const end = start + view.getUint32(start, false);
  let pos = start + 8;
  const encoder = new TextEncoder();

  while (pos + 8 <= end && pos + 8 <= len) {
    const sz = view.getUint32(pos, false);
    const ty = String.fromCharCode(
      view.getUint8(pos+4), view.getUint8(pos+5),
      view.getUint8(pos+6), view.getUint8(pos+7)
    );
    if (sz < 8) break;

    if (ty === 'hdlr') {
      const nameStart = pos + 32;
      const maxLen = Math.min(48, end - nameStart);
      const arr = new Uint8Array(data);
      const nameBytes = encoder.encode('Krynox Encoder\0');
      for (let i = 0; i < Math.min(nameBytes.length, maxLen); i++) {
        arr[nameStart + i] = nameBytes[i];
      }
    }

    pos += sz;
  }
}
