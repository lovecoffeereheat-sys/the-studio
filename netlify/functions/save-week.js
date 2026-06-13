const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };

  const NOTION_KEY = process.env.NOTION_API_KEY;
  const DS_ID = 'b2b6e024-e1dd-83ce-af70-875e4e76e8e4';

  if (!NOTION_KEY) return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Notion key not configured' }) };

  let body;
  try { body = JSON.parse(event.body); } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { pieces } = body;
  if (!pieces || !pieces.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No pieces provided' }) };

  const typeMap = {
    'Substack Note': 'note',
    'Substack Post': 'essay/post',
    'Essay': 'essay/post',
    'Instagram Caption': 'social post',
    'Email / Newsletter': 'essay/post',
  };

  const platformMap = {
    'Substack': 'substack',
    'Instagram': 'instagram',
    'Facebook': 'facebook',
    'Podcast': 'podcast',
  };

  const results = { ok: 0, failed: 0, errors: [] };

  for (const piece of pieces) {
    const properties = {
      title: [{ text: { content: piece.task || 'untitled' } }],
      status: { select: { name: 'idea' } },
    };

    const ct = typeMap[piece.type];
    if (ct) properties['content type'] = { multi_select: [{ name: ct }] };

    const pl = platformMap[piece.phase] || (piece.type?.toLowerCase().includes('substack') ? 'substack' : null);
    if (pl) properties.platform = { select: { name: pl } };

    if (piece.postDate) {
      properties['post date'] = { date: { start: piece.postDate } };
    }

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
          children: piece.notes ? [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: { rich_text: [{ type: 'text', text: { content: piece.notes } }] }
            }
          ] : []
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        results.failed++;
        results.errors.push(err.message || 'Notion error ' + res.status);
      } else {
        results.ok++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push(err.message);
    }
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify(results) };
};
