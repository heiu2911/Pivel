import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TravelContext = {
  [key: string]: unknown;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TravelQuest AI chưa được cấu hình GEMINI_API_KEY trên Vercel." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const context = (body.context && typeof body.context === "object" ? body.context : {}) as TravelContext;

    if (!question) {
      return NextResponse.json({ error: "Cậu hãy nhập câu hỏi trước nhé." }, { status: 400 });
    }
    if (question.length > 2000) {
      return NextResponse.json({ error: "Câu hỏi tối đa 2.000 ký tự." }, { status: 400 });
    }

    const safeContext = JSON.stringify(context).slice(0, 14000);
    const prompt = `Bạn là TravelQuest AI, trợ lý du lịch thân thiện, nói tiếng Việt tự nhiên và xưng "tớ - cậu".
Nhiệm vụ: tư vấn điểm đến, lịch trình, ăn uống, nghỉ ngơi, di chuyển và giải thích thông tin du lịch.
Hãy tận dụng dữ liệu TravelQuest được cung cấp bên dưới để cá nhân hóa câu trả lời.
Quy tắc:
- Ưu tiên thông tin trong dữ liệu; không tự bịa giờ mở cửa, giá vé, tình trạng giao thông hoặc thời tiết trực tiếp.
- Nếu dữ liệu chưa đủ, nói rõ điều chưa biết và đề nghị người dùng kiểm tra nguồn chính thức.
- Với gợi ý lịch trình, trình bày theo thứ tự hợp lý, có thời lượng tham khảo và lưu ý di chuyển.
- Trả lời rõ ràng, hữu ích, không quá dài; có thể dùng danh sách.
- Không khẳng định đã đặt vé/khách sạn hoặc thực hiện hành động bên ngoài.
Dữ liệu hiện tại của người dùng và TravelQuest:
${safeContext}

Câu hỏi của người dùng:
${question}`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
          },
        }),
        cache: "no-store",
      }
    );

    const payload = await geminiResponse.json();
    if (!geminiResponse.ok) {
      console.error("Gemini API error:", payload?.error?.message ?? geminiResponse.status);
      return NextResponse.json(
        { error: "Gemini chưa phản hồi được. Cậu kiểm tra API key và trạng thái API trong Google AI Studio nhé." },
        { status: 502 }
      );
    }

    const reply = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim();

    if (!reply) {
      return NextResponse.json(
        { error: "Gemini chưa tạo được câu trả lời. Cậu thử hỏi lại nhé." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("TravelQuest AI route error:", error);
    return NextResponse.json(
      { error: "Có lỗi khi xử lý câu hỏi. Cậu thử lại sau nhé." },
      { status: 500 }
    );
  }
}
