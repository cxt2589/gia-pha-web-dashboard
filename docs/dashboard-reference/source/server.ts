import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Setup dirname/filename resolution for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize Gemini API client lazily to prevent crashing on boot if key is missing
  let ai: GoogleGenAI | null = null;
  
  function getGeminiClient(): GoogleGenAI {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        throw new Error("GEMINI_API_KEY is not defined. Please configure it in your Secrets / Environment settings.");
      }
      ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
    return ai;
  }

  // --- API Endpoints ---
  
  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", time: new Date().toISOString() });
  });

  // Gemini completion proxy for Cao Ninh Binh Heritage Assistant
  app.post("/api/gemini", async (req, res) => {
    try {
      const { prompt, type, documents } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Yêu cầu cung cấp nội dung câu hỏi (prompt)." });
      }

      // Context-aware historical system instruction for the lineage
      let systemInstruction = 
        `Bạn là "Trợ lý Gia tộc Cao Ninh Bình" - một AI thông minh được lập trình riêng để đồng hành cùng Ban trị sự dòng họ Cao tại Ninh Bình (một dòng họ lâu đời có khởi tổ là Cao Quý Công (húy Cao Văn Lãm) định cư tại Hoa Lư, Ninh Bình từ cuối thế kỷ 17, triều đại Lê trung hưng).
        
        Nhiệm vụ của bạn gồm:
        1. Hán Nôm & Di sản: Dịch nghĩa hoành phi, câu đối, văn bia chữ Hán Nôm cổ, gia phả cổ tự; lý giải ý nghĩa sâu sắc các bức sắc phong cổ của triều đình phong kiến (Tây Sơn, nhà Nguyễn).
        2. Tán gia sự / Văn cúng: Soạn thảo các bài khấn nôm, văn sớ dâng hương tế lễ tổ tiên trang nghiêm tôn kính vào dịp đại hội dòng họ, tết Nguyên Đán, thanh minh tảo mộ hoặc ngày Giỗ Đại Tổ (15/3 âm lịch).
        3. Văn thư dòng họ: Soạn thảo thư ngỏ, lời hiệu triệu, bản tin tôn tạo lăng miếu đức tổ, báo cáo khuyến học vinh danh gia tộc hiếu thảo bằng lời văn tha thiết, hàm súc, giàu lòng biết ơn tiên tổ.
        4. Hỏi đáp lịch sử: Trả lời về các truyền thống văn hóa làng xã Ninh Bình (Hoa Lư, Yên Khánh, Gia Viễn), phong thủy mồ mả đất cát, cúng giỗ sao cho đúng phép xưa của sỹ phu Việt Nam.

        Quy tắc trả lời:
        - Luôn sử dụng ngôn phong lễ phép, trang nghiêm, nho nhã, tôn cổ, chứa chan lòng tôn kính với tiên tổ dòng họ.
        - Xưng hô là "Trợ lý Gia tộc" và gọi người quản trị là "Quý nhân" hoặc "Gia trưởng", "Ban Trị Sự".
        - Đối với các câu hỏi về Hán Nôm, hãy phiên âm Hán-Việt rồi dịch nghĩa rõ ràng để bộc lộ hết điển tích cổ học.
        - Trình bày dạng Markdown tuyệt đẹp, phân chia các đầu mục lịch lãm.`;

      // Modify instruction based on requested helper action type
      if (type === "translate") {
        systemInstruction += "\nĐặc biệt chú trọng phân tích từ vựng biên dịch chữ Hán Nôm, bóc tách âm, nghĩa và bối cảnh sử học phù hợp nhất.";
      } else if (type === "ceremony") {
        systemInstruction += "\nĐặc biệt chú trọng cấu trúc bài Văn tế/văn khấn cổ truyền: Thượng hương, dâng rượu, sớ trạng, tuyên đức, cầu xin khấn bái đại bái.";
      } else if (type === "appeal") {
        systemInstruction += "\nĐặc biệt chú trọng viết thư ngỏ kêu gọi đóng góp tôn tạo, thắt chặt mối bang giao huyết thống, kích hoạt tinh thần 'uống nước nhớ nguồn'.";
      } else if (type === "zalo_campaign") {
        systemInstruction += "\nĐặc biệt chú trọng soạn thảo TIN NHẮN PHÁT SÓNG NGẮN GỌN qua Zalo OA, kêu gọi con cháu đoàn kết dòng họ dâng hương tế tổ hay đóng góp quỹ khuyến học. Viết súc tích, tình cảm gia tộc thâm trầm.";
      }

      // Add Custom Documents Context to System Instruction if passed
      if (Array.isArray(documents) && documents.length > 0) {
        systemInstruction += `\n\n[KHO TÀI LIỆU PHẢ HỆ VÀ LỊCH SỬ THAM CHIẾU GIA TRUYỀN DÒNG HỌ]:
        Dưới đây là tư liệu chính sử quý nhân nạp thêm vào bộ não AI của bạn. Hãy ưu tiên tra cứu nguồn gốc thế bối ở đây để trả lời câu hỏi:`;
        
        documents.forEach((doc: any, i: number) => {
          systemInstruction += `\n\n--- Tài liệu ${i + 1}: ${doc.title} (${doc.category}) ---\n${doc.content}`;
        });
        
        systemInstruction += "\n\n[HẾT KHO TÀI LIỆU DÒNG HỌ THAM CHIẾU].";
      }

      const client = getGeminiClient();
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const responseText = response.text || "Trợ lý chưa kịp sinh ý, xin Quý trưởng lão thử lại.";
      res.json({ text: responseText });
    } catch (error: any) {
      console.error("Gemini API Error in backend:", error);
      res.status(500).json({ 
        error: "Trục trặc hệ thống kết nối AI", 
        details: error.message || error 
      });
    }
  });

  // --- Vite Dev Middleware and Static Assets Serving ---
  
  if (process.env.NODE_ENV !== "production") {
    // Development mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    app.use(vite.middlewares);
    console.log("Vite middleware mounted in development mode.");
  } else {
    // Production mode
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files first
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log(`Serving static assets from ${distPath} in production mode.`);
  }

  // Bind server exclusively to port 3000 and 0.0.0.0
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
