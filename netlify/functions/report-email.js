const json=(statusCode,body)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:JSON.stringify(body)});
const esc=(v)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function adminAuthorized(event){
  const expected=String(process.env.MML_RESERVATION_ADMIN_PASSWORD||'modumam2026');
  const supplied=String(event.headers?.['x-mml-admin-password']||event.headers?.['X-MML-Admin-Password']||'');
  return supplied===expected;
}
exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return json(405,{error:'Method not allowed'});
  if(!adminAuthorized(event))return json(401,{error:'관리자 인증이 필요합니다.'});
  const apiKey=String(process.env.RESEND_API_KEY||'').trim();
  const from=String(process.env.REPORT_EMAIL_FROM||'').trim();
  if(!apiKey||!from)return json(503,{error:'이메일 발송 설정이 아직 완료되지 않았습니다. Netlify에 RESEND_API_KEY와 REPORT_EMAIL_FROM을 설정해 주세요.'});
  let body={}; try{body=JSON.parse(event.body||'{}')}catch(_){return json(400,{error:'잘못된 요청입니다.'})}
  const to=String(body.to||'').trim();
  const reportHtml=String(body.reportHtml||'').trim();
  if(!/^\S+@\S+\.\S+$/.test(to))return json(400,{error:'받는 이메일 주소를 확인해 주세요.'});
  if(!reportHtml)return json(400,{error:'발송할 승인 보고서가 없습니다.'});
  const clientName=String(body.clientName||'내담자').trim();
  const reportTitle=String(body.reportTitle||'심리검사 보고서').trim();
  const filename=`MODUMAM_Report_${String(body.reportId||Date.now()).replace(/[^0-9A-Za-z_-]/g,'_')}.html`;
  const content=Buffer.from(reportHtml,'utf8').toString('base64');
  const mailHtml=`<div style="font-family:Arial,sans-serif;line-height:1.7;color:#24342f"><h2>모두의 마음연구소</h2><p>${esc(clientName)}님, 신청하신 <strong>${esc(reportTitle)}</strong>를 보내드립니다.</p><p>개인정보 보호를 위해 보고서 내용은 홈페이지에 공개하지 않으며 첨부파일로 전달합니다.</p><p style="font-size:12px;color:#64748b">본 메일과 첨부파일에는 개인 심리정보가 포함될 수 있습니다. 공용 기기에서 열람하거나 타인에게 전달하지 않도록 주의해 주세요.</p></div>`;
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json','User-Agent':'MODUMAM-LAB/1.0'},body:JSON.stringify({from,to:[to],subject:`[모두의 마음연구소] ${reportTitle}`,html:mailHtml,attachments:[{filename,content}],tags:[{name:'type',value:'assessment_report'}]})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)return json(response.status,{error:result.message||result.error||'이메일 발송 서비스 오류가 발생했습니다.'});
  return json(200,{ok:true,id:result.id||'',to});
};
