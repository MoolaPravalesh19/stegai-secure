import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple XOR decryption for the message
function decryptMessage(encrypted: string, key: string): string {
  if (!key) return encrypted;
  let result = "";
  for (let i = 0; i < encrypted.length; i++) {
    result += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// Decode LSB steganography from BMP pixel data
function decodeLSB(pixelData: Uint8Array): string | null {
  // Extract bits from LSB
  const bits: number[] = [];
  for (let i = 0; i < Math.min(pixelData.length, 100000); i++) {
    bits.push(pixelData[i] & 1);
  }
  
  // Convert first 32 bits to length
  let length = 0;
  for (let i = 0; i < 32; i++) {
    length = (length << 1) | bits[i];
  }
  
  // Sanity check
  if (length <= 0 || length > 100000) {
    return null;
  }
  
  // Extract message bytes
  const messageBytes: number[] = [];
  for (let i = 0; i < length; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      const bitIndex = 32 + i * 8 + j;
      if (bitIndex >= bits.length) return null;
      byte = (byte << 1) | bits[bitIndex];
    }
    messageBytes.push(byte);
  }
  
  // Verify end marker
  const endMarkerBits = 32 + length * 8;
  if (endMarkerBits + 56 <= bits.length) { // 7 bytes for "<<END>>"
    const markerBytes: number[] = [];
    for (let i = 0; i < 7; i++) {
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | bits[endMarkerBits + i * 8 + j];
      }
      markerBytes.push(byte);
    }
    const marker = String.fromCharCode(...markerBytes);
    if (marker !== "<<END>>") {
      // Marker not found but we still have message data
      console.log("End marker not found, attempting to decode anyway");
    }
  }
  
  return new TextDecoder().decode(new Uint8Array(messageBytes));
}

// Parse BMP and return pixel data
function parseBMP(data: Uint8Array): { width: number; height: number; pixels: Uint8Array } | null {
  if (data[0] !== 0x42 || data[1] !== 0x4D) {
    return null;
  }
  
  const view = new DataView(data.buffer);
  
  const pixelOffset = view.getUint32(10, true);
  const width = view.getInt32(18, true);
  const height = Math.abs(view.getInt32(22, true));
  const bitsPerPixel = view.getUint16(28, true);
  const isBottomUp = view.getInt32(22, true) > 0;
  
  if (bitsPerPixel !== 24 && bitsPerPixel !== 32) {
    return null;
  }
  
  const bytesPerPixel = bitsPerPixel / 8;
  const rowSize = Math.ceil((width * bytesPerPixel) / 4) * 4;
  
  const pixels = new Uint8Array(width * height * 3);
  
  for (let y = 0; y < height; y++) {
    const srcY = isBottomUp ? (height - 1 - y) : y;
    const rowOffset = pixelOffset + srcY * rowSize;
    
    for (let x = 0; x < width; x++) {
      const srcIdx = rowOffset + x * bytesPerPixel;
      const dstIdx = (y * width + x) * 3;
      
      if (srcIdx + 2 < data.length) {
        pixels[dstIdx] = data[srcIdx + 2];     // R
        pixels[dstIdx + 1] = data[srcIdx + 1]; // G
        pixels[dstIdx + 2] = data[srcIdx];     // B
      }
    }
  }
  
  return { width, height, pixels };
}

// Find marker in byte array
function findMarker(data: Uint8Array, marker: string): number {
  const markerBytes = new TextEncoder().encode(marker);
  
  // Search from end of file backwards
  for (let i = data.length - markerBytes.length; i >= 0; i--) {
    let found = true;
    for (let j = 0; j < markerBytes.length; j++) {
      if (data[i + j] !== markerBytes[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const imageFile = formData.get("image") as File;
    const decryptionKey = formData.get("decryptionKey") as string || "";

    if (!imageFile) {
      return new Response(JSON.stringify({ error: "Image is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageData = new Uint8Array(arrayBuffer);

    let decryptedMessage: string | null = null;
    let method = "";

    // Try Method 1: BMP LSB steganography
    const bmpData = parseBMP(imageData);
    if (bmpData) {
      const lsbMessage = decodeLSB(bmpData.pixels);
      if (lsbMessage && lsbMessage.length > 0) {
        decryptedMessage = decryptMessage(lsbMessage, decryptionKey);
        method = "LSB";
      }
    }

    // Try Method 2: Appended data with new marker format
    if (!decryptedMessage) {
      const startMarkerIdx = findMarker(imageData, "<<STEGO_START>>");
      const endMarkerIdx = findMarker(imageData, "<<STEGO_END>>");
      
      if (startMarkerIdx !== -1 && endMarkerIdx !== -1 && endMarkerIdx > startMarkerIdx) {
        const markerLen = "<<STEGO_START>>".length;
        const lengthStart = startMarkerIdx + markerLen;
        
        if (lengthStart + 4 <= imageData.length) {
          const view = new DataView(imageData.buffer);
          const messageLength = view.getUint32(lengthStart, false);
          
          const messageStart = lengthStart + 4;
          const messageEnd = messageStart + messageLength;
          
          if (messageEnd <= endMarkerIdx) {
            const messageBytes = imageData.slice(messageStart, messageEnd);
            const encryptedMessage = new TextDecoder().decode(messageBytes);
            decryptedMessage = decryptMessage(encryptedMessage, decryptionKey);
            method = "Append-New";
          }
        }
      }
    }

    // Try Method 3: Old marker format (backward compatibility)
    if (!decryptedMessage) {
      const oldMarker = "STEGO";
      const oldMarkerIdx = findMarker(imageData, oldMarker);
      
      if (oldMarkerIdx !== -1) {
        const lengthStart = oldMarkerIdx + oldMarker.length;
        
        if (lengthStart + 4 <= imageData.length) {
          const view = new DataView(imageData.buffer);
          const messageLength = view.getUint32(lengthStart, false);
          
          if (messageLength > 0 && messageLength < 100000) {
            const messageStart = lengthStart + 4;
            const messageEnd = messageStart + messageLength;
            
            if (messageEnd <= imageData.length) {
              const messageBytes = imageData.slice(messageStart, messageEnd);
              const encryptedMessage = new TextDecoder().decode(messageBytes);
              decryptedMessage = decryptMessage(encryptedMessage, decryptionKey);
              method = "Append-Old";
            }
          }
        }
      }
    }

    if (!decryptedMessage) {
      return new Response(JSON.stringify({ 
        error: "No hidden message found in this image. Make sure you're using an image that was encoded with this tool.",
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const endTime = Date.now();
    const decodingTime = endTime - startTime;

    // Save to history
    await supabase.from("encryption_history").insert({
      user_id: user.id,
      operation_type: "decode",
      filename: imageFile.name,
      message: decryptedMessage.substring(0, 100),
      encoding_time_ms: decodingTime,
      status: "success",
    });

    return new Response(JSON.stringify({
      success: true,
      message: decryptedMessage,
      decodingTimeMs: decodingTime,
      method: method,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Decode error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
