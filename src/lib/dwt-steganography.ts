/**
 * DWT (Discrete Wavelet Transform) based Image Steganography
 * Uses Haar wavelet transform for embedding/extracting data in the green channel
 */

// Haar 2D DWT - returns [cA, cH, cV, cD] subbands
export function dwt2(channel: Float64Array, width: number, height: number): {
  cA: Float64Array;
  cH: Float64Array;
  cV: Float64Array;
  cD: Float64Array;
  halfWidth: number;
  halfHeight: number;
} {
  const halfWidth = Math.floor(width / 2);
  const halfHeight = Math.floor(height / 2);
  
  // Temporary storage for row-wise transform
  const temp = new Float64Array(halfWidth * 2 * height);
  const tempLow = new Float64Array(halfWidth * height);
  const tempHigh = new Float64Array(halfWidth * height);
  
  // Row-wise 1D DWT
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const idx1 = y * width + x * 2;
      const idx2 = y * width + x * 2 + 1;
      const a = channel[idx1];
      const b = x * 2 + 1 < width ? channel[idx2] : a;
      
      const outIdx = y * halfWidth + x;
      tempLow[outIdx] = (a + b) / 2;  // Low pass (approximation)
      tempHigh[outIdx] = (a - b) / 2; // High pass (detail)
    }
  }
  
  // Column-wise 1D DWT on low and high results
  const cA = new Float64Array(halfWidth * halfHeight);
  const cH = new Float64Array(halfWidth * halfHeight);
  const cV = new Float64Array(halfWidth * halfHeight);
  const cD = new Float64Array(halfWidth * halfHeight);
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      const idx1 = (y * 2) * halfWidth + x;
      const idx2 = (y * 2 + 1) * halfWidth + x;
      
      const aLow = tempLow[idx1];
      const bLow = y * 2 + 1 < height ? tempLow[idx2] : aLow;
      const aHigh = tempHigh[idx1];
      const bHigh = y * 2 + 1 < height ? tempHigh[idx2] : aHigh;
      
      const outIdx = y * halfWidth + x;
      cA[outIdx] = (aLow + bLow) / 2;   // LL - Approximation
      cV[outIdx] = (aLow - bLow) / 2;   // LH - Vertical detail
      cH[outIdx] = (aHigh + bHigh) / 2; // HL - Horizontal detail
      cD[outIdx] = (aHigh - bHigh) / 2; // HH - Diagonal detail
    }
  }
  
  return { cA, cH, cV, cD, halfWidth, halfHeight };
}

// Inverse Haar 2D DWT - reconstructs channel from subbands
export function idwt2(
  cA: Float64Array,
  cH: Float64Array,
  cV: Float64Array,
  cD: Float64Array,
  halfWidth: number,
  halfHeight: number,
  originalWidth: number,
  originalHeight: number
): Float64Array {
  // Column-wise inverse 1D DWT
  const tempLow = new Float64Array(halfWidth * originalHeight);
  const tempHigh = new Float64Array(halfWidth * originalHeight);
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      const inIdx = y * halfWidth + x;
      const outIdx1 = (y * 2) * halfWidth + x;
      const outIdx2 = (y * 2 + 1) * halfWidth + x;
      
      // Reconstruct from LL and LH (cA and cV)
      tempLow[outIdx1] = cA[inIdx] + cV[inIdx];
      if (y * 2 + 1 < originalHeight) {
        tempLow[outIdx2] = cA[inIdx] - cV[inIdx];
      }
      
      // Reconstruct from HL and HH (cH and cD)
      tempHigh[outIdx1] = cH[inIdx] + cD[inIdx];
      if (y * 2 + 1 < originalHeight) {
        tempHigh[outIdx2] = cH[inIdx] - cD[inIdx];
      }
    }
  }
  
  // Row-wise inverse 1D DWT
  const result = new Float64Array(originalWidth * originalHeight);
  
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const inIdx = y * halfWidth + x;
      const outIdx1 = y * originalWidth + x * 2;
      const outIdx2 = y * originalWidth + x * 2 + 1;
      
      result[outIdx1] = tempLow[inIdx] + tempHigh[inIdx];
      if (x * 2 + 1 < originalWidth) {
        result[outIdx2] = tempLow[inIdx] - tempHigh[inIdx];
      }
    }
  }
  
  return result;
}

// Process encryption: Binary Complement & Normalization
export function processEncryption(text: string): { normMsg: number[]; M: number; n: number } {
  const asciiVals = Array.from(text).map(c => c.charCodeAt(0));
  const M = Math.max(...asciiVals);
  
  const normMsg: number[] = [];
  for (const val of asciiVals) {
    const binVal = val.toString(2).padStart(8, '0');
    const compVal = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    normMsg.push(parseInt(compVal, 2) + M);
  }
  
  return { normMsg, M, n: text.length };
}

// Embed text into image using DWT
export function embedText(
  imageData: ImageData,
  secretText: string
): ImageData {
  const { width, height, data } = imageData;
  
  // Extract green channel
  const greenChannel = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    greenChannel[i] = data[i * 4 + 1]; // Green channel
  }
  
  // Process the secret text
  const { normMsg, M, n } = processEncryption(secretText);
  
  // Apply DWT
  const { cA, cH, cV, cD, halfWidth, halfHeight } = dwt2(greenChannel, width, height);
  
  // Hide metadata in cH[0,0] and cH[0,1]
  cH[0] = n; // Length of message
  cH[1] = M; // Max ASCII value
  
  // Split message and embed in cV and cD
  const mid = Math.floor(n / 2);
  for (let i = 0; i < mid && i < cV.length; i++) {
    cV[i] = normMsg[i];
  }
  for (let i = 0; i < n - mid && i < cD.length; i++) {
    cD[i] = normMsg[mid + i];
  }
  
  // Reconstruct with IDWT
  const stegoGreen = idwt2(cA, cH, cV, cD, halfWidth, halfHeight, width, height);
  
  // Create stego image
  const stegoData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    stegoData[idx] = data[idx];         // Red
    stegoData[idx + 1] = Math.max(0, Math.min(255, Math.round(stegoGreen[i]))); // Green
    stegoData[idx + 2] = data[idx + 2]; // Blue
    stegoData[idx + 3] = data[idx + 3]; // Alpha
  }
  
  return new ImageData(stegoData, width, height);
}

// Extract text from stego image using DWT
export function extractText(imageData: ImageData): string {
  const { width, height, data } = imageData;
  
  // Extract green channel
  const stegoGreen = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    stegoGreen[i] = data[i * 4 + 1]; // Green channel
  }
  
  // Apply DWT
  const { cH, cV, cD } = dwt2(stegoGreen, width, height);
  
  // Extract metadata
  const extN = Math.round(cH[0]); // Length
  const extM = Math.round(cH[1]); // Max value
  
  if (extN <= 0 || extN > 10000 || extM <= 0 || extM > 255) {
    throw new Error('No valid embedded message found in this image');
  }
  
  // Recover normalized message
  const mid = Math.floor(extN / 2);
  const recoveredNorm: number[] = [];
  
  for (let i = 0; i < mid && i < cV.length; i++) {
    recoveredNorm.push(cV[i]);
  }
  for (let i = 0; i < extN - mid && i < cD.length; i++) {
    recoveredNorm.push(cD[i]);
  }
  
  // Decrypt the message
  let extractedText = '';
  for (const val of recoveredNorm) {
    const revNorm = Math.round(val) - extM;
    const binVal = (revNorm & 0xFF).toString(2).padStart(8, '0');
    const origBin = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    const charCode = parseInt(origBin, 2);
    if (charCode >= 32 && charCode <= 126) {
      extractedText += String.fromCharCode(charCode);
    }
  }
  
  return extractedText;
}
