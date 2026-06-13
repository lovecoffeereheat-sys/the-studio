const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const NOTION_KEY = process.env.NOTION_API_KEY;
  const DS_ID = '3756e024-e1dd-8070-a944-edd4d9a9d690';

  if (!NOTION_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Notion key not configured' }) };

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { title, status, contentType, pillar, platform, tone, content } = body;

  if (!title) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Title is required' }) };

  const properties = {
  title: { title: [{ text: { content: title } }] },
};
if (status) properties.status = { select: { name: status } };
if (contentType) properties['content type'] = { multi_select: [{ name: contentType }] };
if (pillar) properties.pillar = { select: { name: pillar } };
if (platform) properties.platform = { select: { name: platform } };
if (tone) properties.tone = { select: { name: tone } };

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_KEY,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: DS_ID },
        properties,
        children: content ? [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: content.slice(0, 2000) } }]
            }
          }
        ] : []
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: err.message || 'Notion error ' + res.status }) };
    }

    const data = await res.json();
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, pageId: data.id }) };
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: err.message }) };
  }
};
