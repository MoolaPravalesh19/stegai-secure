/**
 * DWT (Discrete Wavelet Transform) based Image Steganography
 * Uses Haar wavelet transform for embedding/extracting data in the green channel
 * This implementation matches PyWavelets (pywt.dwt2) behavior exactly
 * 
 * PyWavelets 2D DWT output structure:
 * - cA (LL): rows low-pass → cols low-pass (approximation)
 * - cH (LH): rows low-pass → cols high-pass (horizontal details)
 * - cV (HL): rows high-pass → cols low-pass (vertical details)
 * - cD (HH): rows high-pass → cols high-pass (diagonal details)
 */

// Haar 2D DWT - matches pywt.dwt2(data, 'haar') output exactly
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
  
  // Step 1: Row-wise 1D Haar DWT (apply to each row)
  // lowRows = L (low-pass on rows)
  // highRows = H (high-pass on rows)
  const lowRows = new Float64Array(halfWidth * height);
  const highRows = new Float64Array(halfWidth * height);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const a = channel[y * width + x * 2];
      const b = channel[y * width + x * 2 + 1];
      
      // Haar wavelet: average and difference (divided by 2 for normalization)
      lowRows[y * halfWidth + x] = (a + b) / 2;
      highRows[y * halfWidth + x] = (a - b) / 2;
    }
  }
  
  // Step 2: Column-wise 1D Haar DWT
  // Apply to lowRows → gives LL (cA) and LH (cH)
  // Apply to highRows → gives HL (cV) and HH (cD)
  const cA = new Float64Array(halfWidth * halfHeight); // LL
  const cH = new Float64Array(halfWidth * halfHeight); // LH - from lowRows, high-pass on cols
  const cV = new Float64Array(halfWidth * halfHeight); // HL - from highRows, low-pass on cols
  const cD = new Float64Array(halfWidth * halfHeight); // HH
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      // Get pairs from lowRows (L from row transform)
      const aLow = lowRows[(y * 2) * halfWidth + x];
      const bLow = lowRows[(y * 2 + 1) * halfWidth + x];
      
      // Get pairs from highRows (H from row transform)
      const aHigh = highRows[(y * 2) * halfWidth + x];
      const bHigh = highRows[(y * 2 + 1) * halfWidth + x];
      
      const idx = y * halfWidth + x;
      
      // Column transform on lowRows: LL and LH
      cA[idx] = (aLow + bLow) / 2;   // LL - Approximation (low rows, low cols)
      cH[idx] = (aLow - bLow) / 2;   // LH - Horizontal details (low rows, high cols)
      
      // Column transform on highRows: HL and HH
      cV[idx] = (aHigh + bHigh) / 2; // HL - Vertical details (high rows, low cols)
      cD[idx] = (aHigh - bHigh) / 2; // HH - Diagonal details (high rows, high cols)
    }
  }
  
  return { cA, cH, cV, cD, halfWidth, halfHeight };
}

// Inverse Haar 2D DWT - matches pywt.idwt2 exactly
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
  // Step 1: Column-wise inverse 1D Haar DWT
  // Reconstruct lowRows from cA (LL) and cH (LH)
  // Reconstruct highRows from cV (HL) and cD (HH)
  const lowRows = new Float64Array(halfWidth * originalHeight);
  const highRows = new Float64Array(halfWidth * originalHeight);
  
  for (let x = 0; x < halfWidth; x++) {
    for (let y = 0; y < halfHeight; y++) {
      const idx = y * halfWidth + x;
      
      // Inverse column transform for lowRows (from cA and cH)
      lowRows[(y * 2) * halfWidth + x] = cA[idx] + cH[idx];
      lowRows[(y * 2 + 1) * halfWidth + x] = cA[idx] - cH[idx];
      
      // Inverse column transform for highRows (from cV and cD)
      highRows[(y * 2) * halfWidth + x] = cV[idx] + cD[idx];
      highRows[(y * 2 + 1) * halfWidth + x] = cV[idx] - cD[idx];
    }
  }
  
  // Step 2: Row-wise inverse 1D Haar DWT
  const result = new Float64Array(originalWidth * originalHeight);
  
  for (let y = 0; y < originalHeight; y++) {
    for (let x = 0; x < halfWidth; x++) {
      const low = lowRows[y * halfWidth + x];
      const high = highRows[y * halfWidth + x];
      
      // Inverse row transform
      result[y * originalWidth + x * 2] = low + high;
      result[y * originalWidth + x * 2 + 1] = low - high;
    }
  }
  
  return result;
}

// Process encryption: Binary Complement & Normalization (matches Python exactly)
export function processEncryption(text: string): { normMsg: number[]; M: number; n: number } {
  const asciiVals = Array.from(text).map(c => c.charCodeAt(0));
  const M = Math.max(...asciiVals);
  
  const normMsg: number[] = [];
  for (const val of asciiVals) {
    // Convert to 8-bit binary, then complement (0→1, 1→0), then add M
    const binVal = val.toString(2).padStart(8, '0');
    const compVal = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    normMsg.push(parseInt(compVal, 2) + M);
  }
  
  return { normMsg, M, n: text.length };
}

// Embed text into image using DWT (matches Python FastAPI logic exactly)
export function embedText(
  imageData: ImageData,
  secretText: string
): ImageData {
  const { width, height, data } = imageData;
  
  // Extract green channel as Float64Array (like NumPy)
  const greenChannel = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    greenChannel[i] = data[i * 4 + 1]; // Green channel
  }
  
  // Process the secret text (encryption)
  const { normMsg, M, n } = processEncryption(secretText);
  
  // Apply 2D DWT (like pywt.dwt2)
  const { cA, cH, cV, cD, halfWidth, halfHeight } = dwt2(greenChannel, width, height);
  
  // Check capacity
  const maxCapacity = cV.length + cD.length;
  if (n > maxCapacity) {
    throw new Error(`Message too long. Maximum ${maxCapacity} characters allowed.`);
  }
  
  // Store metadata in cH[0,0] and cH[0,1] (Python: cH1[0,0] = n, cH1[0,1] = M)
  cH[0] = n; // Length at flat index 0 = [0,0]
  cH[1] = M; // Max ASCII at flat index 1 = [0,1]
  
  // Split and embed message (Python uses .flat[] indexing)
  // Python: for i in range(mid): cV1.flat[i] = norm_msg[i]
  const mid = Math.floor(n / 2);
  for (let i = 0; i < mid; i++) {
    cV[i] = normMsg[i];
  }
  // Python: for i in range(n - mid): cD1.flat[i] = norm_msg[mid + i]
  for (let i = 0; i < n - mid; i++) {
    cD[i] = normMsg[mid + i];
  }
  
  // Reconstruct with inverse DWT (like pywt.idwt2)
  const stegoGreen = idwt2(cA, cH, cV, cD, halfWidth, halfHeight, width, height);
  
  // Create stego image with clipped green channel (Python: np.clip(stego_green, 0, 255))
  const stegoData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    stegoData[idx] = data[idx];         // Red - unchanged
    stegoData[idx + 1] = Math.round(Math.max(0, Math.min(255, stegoGreen[i]))); // Green - modified
    stegoData[idx + 2] = data[idx + 2]; // Blue - unchanged
    stegoData[idx + 3] = data[idx + 3]; // Alpha - unchanged
  }
  
  return new ImageData(stegoData, width, height);
}

// Extract text from stego image using DWT (matches Python FastAPI logic exactly)
export function extractText(imageData: ImageData): string {
  const { width, height, data } = imageData;
  
  // Extract green channel
  const stegoGreen = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) {
    stegoGreen[i] = data[i * 4 + 1];
  }
  
  // Apply 2D DWT
  const { cH, cV, cD } = dwt2(stegoGreen, width, height);
  
  // Extract metadata (Python: ext_n = int(round(cH11[0,0])), ext_M = int(round(cH11[0,1])))
  const extN = Math.round(cH[0]);
  const extM = Math.round(cH[1]);
  
  // Validate metadata
  if (extN <= 0 || extN > 10000) {
    throw new Error('No valid embedded message found (invalid length)');
  }
  if (extM <= 0 || extM > 255) {
    throw new Error('No valid embedded message found (invalid max value)');
  }
  
  // Recover message (Python: recovered_norm = list(cV11.flat[:ext_n//2]) + list(cD11.flat[:ext_n - ext_n//2]))
  const mid = Math.floor(extN / 2);
  const recoveredNorm: number[] = [];
  
  for (let i = 0; i < mid; i++) {
    recoveredNorm.push(cV[i]);
  }
  for (let i = 0; i < extN - mid; i++) {
    recoveredNorm.push(cD[i]);
  }
  
  // Decrypt message (reverse binary complement and normalization)
  // Python: rev_norm = int(round(val)) - ext_M
  //         bin_val = format(rev_norm & 0xFF, '08b')
  //         orig_bin = "".join(['1' if b == '0' else '0' for b in bin_val])
  //         extracted_text += chr(int(orig_bin, 2))
  let extractedText = '';
  for (const val of recoveredNorm) {
    const revNorm = Math.round(val) - extM;
    const normalizedVal = revNorm & 0xFF;
    const binVal = normalizedVal.toString(2).padStart(8, '0');
    const origBin = binVal.split('').map(b => b === '0' ? '1' : '0').join('');
    const charCode = parseInt(origBin, 2);
    extractedText += String.fromCharCode(charCode);
  }
  
  return extractedText;
}
