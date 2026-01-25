
import { Mistral } from "@mistralai/mistralai";

const apiKey = "tWiVDSfMFfDJAymNfu1arm7R9ONQJSAK";
const client = new Mistral({ apiKey });

async function main() {
    const tools = [
        {
            type: "function",
            function: {
                name: "test_tool",
                description: "A test tool",
                parameters: { type: "object", properties: {} },
            },
        },
    ];

    const messages = [
        { role: "user", content: "Call the test tool please." },
    ];

    console.log("Sending first request...");
    try {
        const response = await client.chat.complete({
            model: "mistral-small-latest",
            messages: messages as any,
            tools: tools as any,
            toolChoice: "auto",
        });

        const message = response.choices?.[0].message;
        console.log("First response message:", JSON.stringify(message, null, 2));

        if (message?.toolCalls) {

            console.log("Constructing assistant message MANUALLY as if in streaming loop...");

            // Emulate accumulation
            const toolCallAccumulator = message.toolCalls.map(tc => ({
                id: tc.id,
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                },
                type: "function",
                // INTENTIONALLY OMITTING INDEX TO SEE IF IT BREAKS
                // index: tc.index 
            }));

            const assistantMessage = {
                role: "assistant",
                content: null, // explicit null
                toolCalls: toolCallAccumulator
            };

            console.log("Assistant Message:", JSON.stringify(assistantMessage, null, 2));

            const testMessages = [...messages, assistantMessage];

            // Add tool response
            for (const toolCall of message.toolCalls) {
                testMessages.push({
                    role: "tool",
                    name: toolCall.function.name,
                    content: "Tool executed",
                    toolCallId: toolCall.id,
                } as any);
            }

            console.log("Sending second request...");
            const finalResponse = await client.chat.complete({
                model: "mistral-small-latest",
                messages: testMessages as any,
                tools: tools as any,
                toolChoice: "auto",
            });
            console.log("SUCCESS! Final response:", JSON.stringify(finalResponse, null, 2));

        } else {
            console.log("No tool calls triggered.");
        }
    } catch (e: any) {
        console.log("FAILED:", e.message);
        if (e.body) console.log(e.body);
    }
}

main();
