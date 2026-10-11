const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function onRequestPost({ request, env }) {
  if (!env.GEMINI_API_KEY) {
    return json({ error: "AI generation is not configured yet. Add GEMINI_API_KEY as a secret in your hosting environment, then try again." }, 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const product = clean(input.product, 120);
  if (!product) return json({ error: "Please enter what you want to promote." }, 400);

  const businessType = clean(input.businessType, 80) || "small business";
  const businessName = clean(input.businessName, 70);
  const price = clean(input.price, 80);
  const language = clean(input.language, 40) || "English";
  const details = clean(input.details, 500);
  const format = clean(input.format, 60) || "Instagram portrait 4:5";
  const style = clean(input.style, 60) || "Premium and minimal";

  const prompt = [
    "Create one polished, commercially useful social media advertising poster for a small business in Sri Lanka.",
    "This is a finished poster image, not a mockup, not a screenshot, not a collage, and not a photo of a poster on a wall.",
    `Business category: ${businessType}.`,
    `Business/brand name (reproduce exactly if included): ${businessName || "not supplied"}.`,
    `Product or offer: ${product}.`,
    `Price/offer (reproduce exactly if included): ${price || "not supplied"}.`,
    `Language: ${language}.`,
    `Format: ${format}.`,
    `Visual style: ${style}.`,
    `Extra business details: ${details || "none supplied"}.`,
    "Design with strong hierarchy, premium composition, clean spacing, readable contrast, professional lighting and a clear focal product.",
    "Use only the supplied factual details. Do not invent phone numbers, addresses, discounts, guarantees, awards, ingredients, or claims.",
    "If the requested language uses Sinhala, use legible Sinhala script where possible. If text accuracy is uncertain, keep the wording minimal and leave clear negative space rather than inventing gibberish.",
    "Never add watermarks, fake brand logos, QR codes, or extra unrelated text.",
    "If a reference image is provided, use it as visual guidance for the product, but do not claim exact product fidelity. Do not copy any visible third-party watermark.",
    "Output only the generated poster image."
  ].join("\n");

  const parts = [{ text: prompt }];
  if (typeof input.referenceImage === "string" && input.referenceImage.startsWith("data:")) {
    const match = input.referenceImage.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match || !ALLOWED_MIME.has(match[1])) {
      return json({ error: "The reference image format is not supported." }, 400);
    }
    const approximateBytes = Math.floor(match[2].length * 0.75);
    if (approximateBytes > MAX_IMAGE_BYTES) {
      return json({ error: "The reference image must be 5 MB or smaller." }, 400);
    }
    parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
  }

  try {
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
        })
      }
    );

    const result = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const providerMessage = result?.error?.message || "The image provider rejected the request.";
      const safeMessage = upstream.status === 429
        ? "The AI service is busy or its usage limit has been reached. Try later or check your API quota."
        : upstream.status === 400
          ? "The AI service could not process this prompt or image. Check the inputs and try again."
          : "AI image generation failed. Check the API key, model access, and provider settings.";
      return json({ error: `${safeMessage} (${upstream.status})` }, upstream.status === 429 ? 429 : 502);
    }

    const candidates = result?.candidates || [];
    for (const candidate of candidates) {
      for (const part of (candidate?.content?.parts || [])) {
        const data = part?.inlineData?.data || part?.inline_data?.data;
        const mime = part?.inlineData?.mimeType || part?.inline_data?.mime_type || "image/png";
        if (data && mime.startsWith("image/")) {
          return json({ imageData: `data:${mime};base64,${data}` });
        }
      }
    }
    return json({ error: "The AI response did not contain an image. Check model availability and try again." }, 502);
  } catch {
    return json({ error: "Could not connect to the AI image service. Please try again." }, 502);
  }
}

function clean(value, maxLength) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, maxLength)
    : "";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
