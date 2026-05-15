/* ========== Shared AI Streaming Utility ========== */

async function streamAIResponse(prompt, options) {
    if (!BRAINSTORM_WORKER_URL) {
        throw new Error('Please set your Worker URL in settings.');
    }

    options = options || {};
    var provider = options.provider || currentProvider;
    var model = options.model || currentModel;

    var response = await fetch(BRAINSTORM_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: provider, model: model, prompt: prompt, stream: true }),
        signal: options.signal
    });

    if (!response.ok) {
        var err = await response.json();
        throw new Error(err.error || 'Request failed');
    }

    var reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    var decoder = new TextDecoder();
    var buffer = '';
    var text = '';

    while (true) {
        var rr = await reader.read();
        if (rr.done) break;
        buffer += decoder.decode(rr.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (var i = 0; i < lines.length; i++) {
            var trimmed = lines[i].trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            var dataStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
            try {
                var data = JSON.parse(dataStr);
                if (data.error) throw new Error(data.error);
                if (data.text) {
                    text += data.text;
                    if (options.onChunk) options.onChunk(data.text);
                }
            } catch (e) {
            }
        }
    }

    return text;
}
