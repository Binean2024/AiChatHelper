// 全局范围定义微信 ID 鉴权函数
function isWxidAllowed(wxid) {
    const allowedWxids = ['wxid1', 'wxid2', 'wxid3']; // 替换成实际的 wxid 列表
    return allowedWxids.includes(wxid);
}

// 全局范围定义 respondWithError 函数
function respondWithError(messages) {
    const errorResponse = {
        choices: [{
                message: {
                    role: 'assistant',
                    content: messages,
                },
            }
        ],
    };

    return new Response(JSON.stringify(errorResponse), {
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {

    // 从 request.headers 获取 wxid
    const wxid = request.headers.get('wxid');

    // 判断 wxid 是否在允许的数组中
    if (!isWxidAllowed(wxid)) {
        return respondWithError('我是狗，偷接口，偷了接口当小丑～');
    }

    const requestBody = await request.json();
    const messages = requestBody.messages;
    const chatModel = requestBody.model.trim().toLowerCase();
    let apiKey = request.headers.get('authorization');

    if (chatModel === 'gpt-3.5-turbo' || chatModel === 'gpt-4') {
        return handleChatGPTRequest(requestBody, chatModel, apiKey);
    } else if (chatModel === 'gemini-pro' || chatModel === 'gemini') {
        apiKey = apiKey.slice(7);
        const formattedMessages = formatMessagesForGemini(messages);
        return processGeminiRequest(formattedMessages, apiKey);
    } else {
        return respondWithError('不支持的 chat_model 类型');
    }
}

async function handleChatGPTRequest(requestBody, chatModel, apiKey) {

    const url = 'https://api.openai.com/v1/chat/completions';

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': apiKey,
            },
            body: JSON.stringify({
                'model': chatModel,
                'messages': requestBody.messages,
            }),
        });

        const responseData = await response.json();

        // 判断是否有错误信息
        if (responseData.error) {
            // 处理错误逻辑
            const errorMessage = responseData.error.message || '未知错误';
            return respondWithError(`ChatGPT请求出错: ${errorMessage}`);
        }

        // 如果没有错误，返回 ChatGPT API 的响应
        return new Response(JSON.stringify(responseData));
    } catch (error) {
        return respondWithError(`ChatGPT请求出错: ${error.toString()}`);
    }
}

function formatMessagesForGemini(messages) {
    let formattedMessages = [];

    messages.forEach((item, index) => {
        if (index === 0) {
            formattedMessages.push({
                'role': 'user',
                'parts': [{
                        'text': item.content,
                    }
                ],
            }, {
                'role': 'model',
                'parts': [{
                        'text': '好的',
                    }
                ],
            });
        } else if (index === 1 && item.role === 'assistant') {
            // 忽略掉第二条消息
        } else {
            formattedMessages.push({
                'role': (item.role === 'assistant') ? 'model' : 'user',
                'parts': [{
                        'text': item.content,
                    }
                ],
            });
        }
    });

    return formattedMessages;
}

async function processGeminiRequest(contents, apiKey) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'contents': contents,
                "safetySettings": [{
                        "category": "HARM_CATEGORY_HARASSMENT",
                        "threshold": "BLOCK_NONE"
                    }, {
                        "category": "HARM_CATEGORY_HATE_SPEECH",
                        "threshold": "BLOCK_NONE"
                    }, {
                        "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        "threshold": "BLOCK_NONE"
                    }, {
                        "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                        "threshold": "BLOCK_NONE"
                    }
                ],
            }),
        });

        const responseData = await response.json();
        if (responseData.candidates) {
            return new Response(JSON.stringify({
                    'choices': [{
                            'message': {
                                'role': 'assistant',
                                'content': responseData.candidates[0].content.parts[0].text,
                            },
                        }
                    ],
                }));
        } else {
            // 处理失败逻辑，查看是否有错误消息字段
            const errorMessage = responseData.error ? responseData.error.message : '未知错误';
            return respondWithError(`Gemini 请求出错: ${errorMessage}`);
        }
    } catch (error) {
        return respondWithError(`Gemini请求出错: ${error.toString()}`);
    }
}
