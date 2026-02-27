const fs = require('fs');
const img = fs.readFileSync('C:/Users/1/Downloads/微信图片_20260225151140_424_1432.jpg');
const b64 = img.toString('base64');

const prompt = '你是大学录取通知书（offer letter）隐私脱敏专家。请仔细查看这张图片，精准找出申请人/学生的个人敏感信息。\n\n只识别以下6类：\n1. 姓名（学生的中英文名/拼音名，每次出现都要标注，学校教职工不算）\n2. 个人邮箱（xxx@qq.com等个人邮箱，学校官方邮箱不算）\n3. 电话（学生个人电话，学校电话不算）\n4. 证件号（身份证、护照、签证、CAS、I-20、LSAC账号等）\n5. 学号（Application ID、Student ID、Reference Number等）\n6. 出生日期\n\n不是敏感信息（不要返回）：学校名、专业名、奖学金、学费、正文内容、学校邮箱/电话/地址、教职工署名、邮件发送时间、入学日期。\n\n请返回每个敏感信息在图片中的位置bounding box，坐标为0-1000归一化值 [y_min, x_min, y_max, x_max]。\n返回格式：{"sensitive":[{"text":"原文","type":"类型","box":[y_min,x_min,y_max,x_max]}]}\n只返回JSON。';

async function main() {
  console.log('Sending to Gemini 2.5 Flash...');
  const resp = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=YOUR_API_KEY_HERE',
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
  console.log('Raw response:', text);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('\nItems found:', parsed.sensitive.length);

    // The image filename hints at 424x1432
    const imgW = 424, imgH = 1432;
    for (const item of parsed.sensitive) {
      if (item.box) {
        const [yMin, xMin, yMax, xMax] = item.box;
        const px = {
          x0: Math.round(xMin/1000*imgW),
          y0: Math.round(yMin/1000*imgH),
          x1: Math.round(xMax/1000*imgW),
          y1: Math.round(yMax/1000*imgH),
        };
        console.log(`[${item.type}] "${item.text}" norm:${JSON.stringify(item.box)} -> px: (${px.x0},${px.y0})-(${px.x1},${px.y1}) size:${px.x1-px.x0}x${px.y1-px.y0}`);
      }
    }
  }
}
main().catch(e => console.error(e));
