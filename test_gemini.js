const fs = require('fs');
const img = fs.readFileSync('C:/Users/1/Downloads/微信图片_20260225151140_424_1432.jpg');
const b64 = img.toString('base64');

const prompt = `你是大学录取通知书隐私脱敏专家。请仔细查看这张图片，精准找出申请人/学生的个人敏感信息。

只识别以下6类：姓名、个人邮箱、电话、证件号、学号、出生日期。

学校名、专业名、奖学金金额、正文内容、学校官方邮箱/电话、教职工署名等都不是敏感信息，不要返回。

请返回每个敏感信息在图片中的位置（bounding box），坐标为0-1000的归一化值 [y_min, x_min, y_max, x_max]。

返回格式：{"sensitive":[{"text":"原文","type":"类型","box":[y_min,x_min,y_max,x_max]}]}
只返回JSON，不要其他文字。`;

async function main() {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: prompt }
        ]}],
        generationConfig: { temperature: 0.1 }
      })
    }
  );

  if (!resp.ok) {
    console.error('API Error:', resp.status, await resp.text());
    return;
  }

  const result = await resp.json();
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
  console.log('=== Gemini Raw Response ===');
  console.log(text);

  // Parse
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('\n=== Parsed Sensitive Items ===');
    for (const item of parsed.sensitive) {
      console.log(`  [${item.type}] "${item.text}" box:`, item.box);
    }
  }
}

main().catch(e => console.error(e));
