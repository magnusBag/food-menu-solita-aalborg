const OPENAI_API_URL = "https://api.openai.com/v1/images/generations";

export async function createImageFromPrompt(
    prompt: string,
    FileHint: string,
): Promise<string> {
    let response;
    const promptForOpenAI = prompt === "."
        ? "Nice weekend for a programmer"
        : prompt;
    try {
        response = await fetch(OPENAI_API_URL, {
            method: "POST",
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: promptForOpenAI,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json",
            }),
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
            },
        });

        if (!response.ok && response.status === 429) {
            console.log("Retrying after 1 min", { prompt, FileHint });
            await new Promise((resolve) => setTimeout(resolve, 61000));
            return createImageFromPrompt(prompt, FileHint);
        }

        const data = await response.json();

        if (!data.data || !data.data[0] || !data.data[0].b64_json) {
            console.error("Unexpected response format from OpenAI API:", data);
            return "";
        }

        const base64 = data.data[0].b64_json;
        return "data:image/png;base64, " + base64;
    } catch (error) {
        console.error("Error in createImageFromPrompt:", error);
        return "";
    }
}

export async function translateToEnglish(text: string): Promise<string> {
    const messages = [
        {
            role: "system",
            content:
                "You are a helpful assistant that translates Danish text to English. Only translate the text, do not add anything else.",
        },
        {
            role: "user",
            content: text,
        },
    ];
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages,
        }),
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        },
    });
    const data = await response.json();
    console.log(data);

    return data.choices[0].message.content;
}
