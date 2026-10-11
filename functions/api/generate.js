
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent";

export async function onRequestPost({ request, env }) {
  // 1. Check API key
  if (!env.GEMINI_API_KEY) {
    return json(
      {
        error:
          "AI generation is not configured. Add GEMINI_API_KEY to your Cloudflare Pages Production secrets and redeploy.",
        code: "MISSING_API_KEY"
      },
      503
    );
  }

  // 2. Read request
  let input;

  try {
    input = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return json({ error: "Invalid request data." }, 400);
  }

  const product = clean(input.product, 120);

  if (!product) {
    return json(
      { error: "Please enter what you want to promote." },
      400
    );
  }

  const businessType = clean(input.businessType, 80) || "small business";
  const businessName = clean(input.businessName, 70);
  const price = clean(input.price, 80);
  const language = clean(input.language, 40) || "English";
  const details = clean(input.details, 500);
  const format = clean(input.format, 60) || "Instagram portrait 4:5";
  const style = clean(input.style, 60) || "Premium and minimal";

  // 3. Build poster prompt
  const prompt = [
    "Create one polished, commercially useful social media advertising poster for a small business in Sri Lanka.",
    "Output a finished poster image, not a mockup, screenshot, collage, or photograph of a poster.",
    `Business category: ${businessType}.`,
    `Business/brand name: ${businessName || "not supplied"}.`,
    `Product or offer: ${product}.`,
    `Price or offer: ${price || "not supplied"}.`,
    `Language: ${language}.`,
    `Format: ${format}.`,
    `Visual style: ${style}.`,
    `Extra business details: ${details || "none supplied"}.`,
    "Use a strong visual hierarchy, professional lighting, clean spacing, readable contrast, and a clear focal product.",
    "Use only the supplied factual details. Never invent phone numbers, addresses, discounts, guarantees, awards, or claims.",
    "When Sinhala is requested, use legible Sinhala script where possible. Keep wording minimal if accurate text rendering is uncertain.",
    "Do not add watermarks, fake brand logos, QR codes, or unrelated text.",
    "If a reference image is provided, use it as visual guidance. Do not copy third-party watermarks.",
    "Output the generated poster image."
  ].join("\n");

  const parts = [{ text: prompt }];

  // 4. Validate optional reference image
  if (input.referenceImage != null && input.referenceImage !== "") {
    if (
      typeof input.referenceImage !== "string" ||
      !input.referenceImage.startsWith("data:")
    ) {
      return json(
        { error: "The reference image must be a supported image file." },
        400
      );
    }

    const match = input.referenceImage.match(
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match || !ALLOWED_MIME.has(match[1])) {
      return json(
        { error: "Unsupported reference image. Use JPG, PNG, or WebP." },
        400
      );
    }

    const approximateBytes = Math.floor((match[2].length * 3) / 4);

    if (approximateBytes > MAX_IMAGE_BYTES) {
      return json(
        { error: "The reference image must be 5 MB or smaller." },
        400
      );
    }

    parts.push({
      inline_data: {
        mime_type: match[1],
        data: match[2]
      }
    });
  }

  // 5. Call Gemini
  try {
    const upstream = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts
          }
        ],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"]
        }
      })
    });

    const result = await upstream.json().catch(() => ({}));

    // 6. Return useful provider error details
    if (!upstream.ok) {
      const providerMessage =
        typeof result?.error?.message === "string"
          ? result.error.message.slice(0, 700)
          : "The provider returned no error details.";

      const providerStatus = upstream.status;
      let message;
      let code;

      if (providerStatus === 429) {
        message =
          "Gemini API returned HTTP 429. " +
          providerMessage +
          " Check your Gemini API usage, rate limits, and project quota.";
        code = "GEMINI_429";
      } else if (providerStatus === 400) {
        message =
          "Gemini rejected the request (HTTP 400): " + providerMessage;
        code = "GEMINI_BAD_REQUEST";
      } else if (providerStatus === 401 || providerStatus === 403) {
        message =
          "Gemini API authentication or permission error (HTTP " +
          providerStatus +
          "): " +
          providerMessage;
        code = "GEMINI_AUTH_ERROR";
      } else {
        message =
          "Gemini API request failed (HTTP " +
          providerStatus +
          "): " +
          providerMessage;
        code = "GEMINI_PROVIDER_ERROR";
      }

      // Do not log or return the API key.
      console.error("Gemini API error:", {
        status: providerStatus,
        code,
        message: providerMessage
      });

      return json(
        {
          error: message,
          code,
          providerStatus
        },
        providerStatus === 429 ? 429 : 502
      );
    }

    // 7. Find the generated image
    const candidates = result?.candidates || [];

    for (const candidate of candidates) {
      const responseParts = candidate?.content?.parts || [];

      for (const part of responseParts) {
        const data =
          part?.inlineData?.data || part?.inline_data?.data;

        const mime =
          part?.inlineData?.mimeType ||
          part?.inline_data?.mime_type ||
          "image/png";

        if (data && mime.startsWith("image/")) {
          return json({
            imageData: `data:${mime};base64,${data}`
          });
        }
      }
    }

    // 8. Explain responses without an image
    const blockReason =
      result?.promptFeedback?.blockReason ||
      candidates[0]?.finishReason ||
      "";

    console.error("Gemini returned no image:", {
      blockReason: String(blockReason).slice(0, 150)
    });

    return json(
      {
        error: blockReason
          ? "Gemini did not generate an image. Response reason: " +
            String(blockReason).slice(0, 150)
          : "Gemini responded without an image. Check model availability and try again.",
        code: "NO_IMAGE_RETURNED"
      },
      502
    );
  } catch (error) {
    console.error(
      "Gemini connection error:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return json(
      {
        error: "Could not connect to the Gemini image service. Please try again.",
        code: "GEMINI_CONNECTION_ERROR"
      },
      502
    );
  }
}

function clean(value, maxLength) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .trim()
        .slice(0, maxLength)
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
