const fs = require('fs');
const img = fs.readFileSync('C:/Users/1/Downloads/微信图片_20260225151140_424_1432.jpg');
const b64 = img.toString('base64');

const prompt = '你是大学录取通知书（offer letter）隐私脱敏专家。请仔细查看这张图片，精准找出申请人/学生的所有个人敏感信息。目标：遮蔽后任何人都无法识别这是谁的offer。\n\n识别以下8类，每次出现都要单独标注：\n1. 姓名 — 学生的全名、名、姓、中文名、拼音名、英文名。包括"Dear Sylvie"中的名字、收件人/发件人中的学生名字。学校教职工姓名不算。\n2. 邮箱 — 所有邮箱地址都要遮蔽（包括个人邮箱和任何出现的邮箱地址），只有学校官方域名邮箱（如@cornell.edu, @university.edu）不遮。\n3. 电话 — 学生个人电话，学校电话不算。\n4. 证件号 — 身份证、护照号、签证号、CAS号、I-20 SEVIS号等。\n5. 学号/申请号/账号 — Application ID、Student ID、LSAC账号、UCAS ID、Reference Number等。\n6. 出生日期\n7. 个人地址 — 学生的邮寄地址、家庭住址。学校地址不算。\n8. 邮件收发信息 — 邮件界面中显示的收件人邮箱地址、发件人中包含的学生邮箱。\n\n不是敏感信息（不要返回）：学校名、专业名、奖学金金额、学费金额、正文通用内容、学校官方邮箱/电话/地址、教职工署名、邮件发送时间、入学日期、截止日期。\n\n请列出每个敏感信息出现的原文。同一信息出现多次，每次都要单独列出。\n同时返回每个敏感信息在图片中的位置bounding box，坐标为0-1000归一化值 [y_min, x_min, y_max, x_max]。\n返回格式：{"sensitive":[{"text":"原文","type":"类型","box":[y_min,x_min,y_max,x_max]}]}\n只返回JSON。';

async function main() {
  console.log('Testing updated prompt...');
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
  console.log('Raw:', text);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    console.log('\nFound', parsed.sensitive.length, 'items:');
    for (const item of parsed.sensitive) {
      console.log(`  [${item.type}] "${item.text}"  box:${JSON.stringify(item.box)}`);
    }
  }
}
main().catch(e => console.error(e));
