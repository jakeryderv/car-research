async page => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.goto('http://127.0.0.1:8000');
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#vin').fill('1HGCM82633A004352');
  await page.getByRole('button',{name:'Generate report'}).click();
  await page.locator('#vehicle-title').filter({hasText:'2003 HONDA Accord'}).waitFor({timeout:65000});
  assert(await page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)==='dark','Dark mode is default');
  const states = await page.locator('#report details').evaluateAll(nodes=>nodes.map(n=>n.open));
  const records = await page.locator('.record').count();
  assert(records>0,'Live report contains records');
  const [download] = await Promise.all([page.waitForEvent('download'),page.locator('#export-button').click()]);
  assert(download.suggestedFilename()==='vehicle-report-1HGCM82633A004352.html','Export filename includes VIN');
  await download.saveAs('/tmp/car-research-report.html');
  assert(JSON.stringify(await page.locator('#report details').evaluateAll(nodes=>nodes.map(n=>n.open)))===JSON.stringify(states),'HTML export preserves screen disclosure state');
  await page.pdf({path:'/tmp/car-research-report.pdf',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
  assert(JSON.stringify(await page.locator('#report details').evaluateAll(nodes=>nodes.map(n=>n.open)))===JSON.stringify(states),'PDF restores screen disclosure state');
  assert(await page.title()==='Car Research','Print restores page title');
  // Also check the browser print events directly, including the Ctrl+P path.
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert(await page.locator('#report details:not([open])').count()===0,'Print expands all source records');
  await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  try {
    await offline.goto('file:///tmp/car-research-report.html');
    assert(await offline.locator('.record').count()===records,'Offline export retains every record');
    assert(await offline.locator('details:not([open])').count()===0,'Offline export opens every disclosure');
    assert(await offline.locator('script,link[rel="stylesheet"],button').count()===0,'Portable report has no scripts, external stylesheet, or inactive controls');
    assert(await offline.evaluate(()=>getComputedStyle(document.documentElement).colorScheme)==='dark','Offline report retains dark styling');
    assert((await offline.locator('#carfax-link').getAttribute('href')).includes('vin=1HGCM82633A004352'),'Offline source links retain VIN');
    await offline.locator('details').first().evaluate(node=>{node.open=false;});
    await offline.emulateMedia({media:'print'});
    assert(await offline.locator('.fuel-variant').first().locator('dl').isVisible(),'Print CSS includes collapsed offline records');
  } finally { await page.context().setOffline(false); await offline.close(); }
  await page.route('**/styles.css',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.locator('#export-button').click();
  await page.locator('#export-message').filter({hasText:'Could not save'}).waitFor();
  assert(await page.locator('#export-button').isEnabled(),'Failed export can be retried');
  await page.unroute('**/styles.css');
  await page.locator('#export-message').evaluate(node=>{node.textContent='';});
  return {passed:true,records,pdf:'/tmp/car-research-report.pdf',html:'/tmp/car-research-report.html',scenarios:['dark theme','portable offline export','complete records','print expansion and restoration','offline collapsed printing','export failure and retry']};
}
