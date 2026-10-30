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
    const history = Array.isArray(body.history)
      ? body.history.slice(-8).map((item: { role?: string; text?: string }) => ({
          role: item.role === "assistant" ? "TravelQuest AI" : "Người dùng",
          text: typeof item.text === "string" ? item.text.slice(0, 1800) : "",
        })).filter((item: { text: string }) => item.text)
      : [];
    const historyText = history.length
      ? history.map((item: { role: string; text: string }) => `${item.role}: ${item.text}`).join("\\n")
      : "Chưa có hội thoại trước đó.";
    const prompt = `Bạn là TravelQuest AI, một trợ lý lập kế hoạch du lịch chuyên nghiệp, thân thiện, luôn nói tiếng Việt tự nhiên và xưng "tớ - cậu".

MỤC TIÊU:
Giúp người dùng biến yêu cầu ngắn thành kế hoạch du lịch hữu ích, cụ thể và dễ thực hiện. Không trả lời qua loa hoặc chỉ chào hỏi khi người dùng đang yêu cầu lịch trình.

CÁCH LẬP LỊCH TRÌNH:
- Khi người dùng nêu địa điểm và số ngày (ví dụ "Hà Giang 2 ngày"), hãy chủ động lập lịch trình mẫu đầy đủ ngay, không hỏi lại nếu có thể đưa ra giả định hợp lý.
- Chia rõ từng ngày; mỗi ngày có buổi sáng, trưa, chiều, tối nếu phù hợp.
- Mỗi điểm dừng phải có tên, lý do ghé thăm và thời lượng tham khảo; sắp xếp các điểm theo tuyến địa lý hợp lý, tránh đi vòng.
- Gợi ý ăn uống, nghỉ ngơi và nơi lưu trú theo khu vực; nếu không có dữ liệu đã xác minh thì chỉ gợi ý loại hình/khu vực, không bịa tên cơ sở.
- Nêu phương án di chuyển, độ dài hành trình ở mức ước lượng khi có cơ sở; không tự bịa số km hoặc thời gian chính xác.
- Thêm mục ngân sách dự kiến chỉ khi có đủ dữ liệu; nếu không, nêu các khoản cần dự trù thay vì tự đặt giá.
- Kết thúc bằng vài lưu ý thực tế và một câu hỏi ngắn để người dùng có thể tinh chỉnh kế hoạch (ngân sách, phương tiện, sở thích).

HỘI THOẠI:
- Dùng lịch sử gần đây để hiểu các câu như "ngày thứ hai thì sao", "thêm chỗ ăn uống", "đổi sang 3 ngày".
- Không bắt người dùng nhắc lại thông tin đã nói trong lịch sử.
- Nếu người dùng chỉ hỏi một câu đơn giản, trả lời trực tiếp và vừa đủ.

ĐỘ TIN CẬY:
- Phân biệt dữ liệu TravelQuest được cung cấp với kiến thức tổng quát.
- Không tuyên bố đã tra cứu dữ liệu trực tiếp, không bịa giờ mở cửa, giá vé, số điện thoại, tình trạng đường, thời tiết hoặc tình trạng phòng.
- Nếu thông tin có thể thay đổi, nhắc người dùng kiểm tra nguồn chính thức trước khi khởi hành.
- Không khẳng định đã đặt vé/khách sạn hoặc thực hiện hành động bên ngoài.

DỮ LIỆU TRAVELQUEST VÀ NGỮ CẢNH NGƯỜI DÙNG:
${safeContext}

HỘI THOẠI GẦN ĐÂY:
${historyText}

YÊU CẦU MỚI NHẤT:
${question}

Hãy đưa ra câu trả lời hữu ích, có cấu trúc rõ ràng và cụ thể tương xứng với yêu cầu.`;

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
            maxOutputTokens: 2200,
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
