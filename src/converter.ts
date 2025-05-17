import axios from "axios";
import { ClientOptions, OpenAI } from "openai";
import { GoogleAuth } from "google-auth-library";
import Anthropic from "@anthropic-ai/sdk";

export interface ConversionOptions {
  targetLanguage: string;
  provider: "openai" | "gemini" | "anthropic";
  apiKey: string;
}

export async function convertCode(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  switch (options.provider) {
    case "openai":
      return await convertWithOpenAI(code, fileExtension, options);
    case "gemini":
      return await convertWithGemini(code, fileExtension, options);
    case "anthropic":
      return await convertWithAnthropic(code, fileExtension, options);
    default:
      throw new Error(`Provedor de IA não suportado: ${options.provider}`);
  }
}

async function convertWithOpenAI(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const client = new OpenAI({
    apiKey: options.apiKey,
  });

  const prompt = `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
  
  ${code}
  
  Apenas retorne o código convertido, sem explicações adicionais.`;

  try {
    const response = await client.responses.create({
      model: "gpt-4",
      instructions: "",
      input: [{ role: "user", content: prompt }],
    });

    return response.output_text || code;
  } catch (error) {
    console.error("Erro ao chamar a API OpenAI:", error);
    throw new Error("Falha ao converter o código usando OpenAI");
  }
}

async function convertWithGemini(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const apiUrl =
    "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

  try {
    const response = await axios.post(`${apiUrl}?key=${options.apiKey}`, {
      contents: [
        {
          parts: [
            {
              text: `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
            
            ${code}
            
            Apenas retorne o código convertido, sem explicações adicionais.`,
            },
          ],
        },
      ],
    });

    return response.data.candidates[0]?.content?.parts[0]?.text || code;
  } catch (error) {
    console.error("Erro ao chamar a API Gemini:", error);
    throw new Error("Falha ao converter o código usando Gemini");
  }
}

async function convertWithAnthropic(
  code: string,
  fileExtension: string,
  options: ConversionOptions
): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: options.apiKey,
  });

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: `Converta o seguinte código para ${options.targetLanguage}. Mantenha a mesma funcionalidade, mas adapte para os padrões da linguagem alvo:
        
        ${code}
        
        Apenas retorne o código convertido, sem explicações adicionais.`,
        },
      ],
    });

    // Concatenate all text blocks from the response content
    const convertedCode = response.content
      .filter(
        (block: any) => block.type === "text" && typeof block.text === "string"
      )
      .map((block: any) => block.text)
      .join("\n");
    return convertedCode || code;
  } catch (error) {
    console.error("Erro ao chamar a API Anthropic:", error);
    throw new Error("Falha ao converter o código usando Anthropic");
  }
}
