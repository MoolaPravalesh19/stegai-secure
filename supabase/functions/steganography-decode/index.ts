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

    // Get user from token
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

    // Read image as array buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Look for our STEGO marker
    const markerStr = "STEGO";
    const markerBytes = new TextEncoder().encode(markerStr);
    
    let markerIndex = -1;
    for (let i = uint8Array.length - markerBytes.length - 100; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < markerBytes.length; j++) {
        if (uint8Array[i + j] !== markerBytes[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        markerIndex = i;
        break;
      }
    }

    if (markerIndex === -1) {
      return new Response(JSON.stringify({ 
        error: "No hidden message found in this image",
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract message length (4 bytes after marker)
    const lengthStart = markerIndex + markerBytes.length;
    const lengthBytes = uint8Array.slice(lengthStart, lengthStart + 4);
    const messageLength = new DataView(lengthBytes.buffer).getUint32(0, false);

    // Extract message
    const messageStart = lengthStart + 4;
    const messageBytes = uint8Array.slice(messageStart, messageStart + messageLength);
    const encryptedMessage = new TextDecoder().decode(messageBytes);

    // Decrypt if key provided
    const decryptedMessage = decryptMessage(encryptedMessage, decryptionKey);

    const endTime = Date.now();
    const decodingTime = endTime - startTime;

    // Save to history
    await supabase.from("encryption_history").insert({
      user_id: user.id,
      operation_type: "decode",
      filename: imageFile.name,
      message: decryptedMessage.substring(0, 100), // Store first 100 chars only
      encoding_time_ms: decodingTime,
      status: "success",
    });

    return new Response(JSON.stringify({
      success: true,
      message: decryptedMessage,
      decodingTimeMs: decodingTime,
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
