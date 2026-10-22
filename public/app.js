import { validateVin } from './domain.js';

const $ = id => document.getElementById(id);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Number(value).toLocaleString();
let report = null;
const statusText = status => ({ available:'Retrieved', unavailable:'Unavailable', 'not-checked':'Not checked', partial:'Partial results', 'not-covered':'Outside coverage' }[status] || 'Not checked');
const stamp = value => value ? new Date(value).toLocaleString() : 'Not checked';
const sourceLink = source => source.url ? `<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.name)} ↗</a> · ${escape(stamp(source.checkedAt))}` : escape(source.name);
function message(id, text) { $(id).textContent = text; }

let activeRequest = null;

function showSearch() {
  $('report').hidden = true;
  $('search-view').hidden = false;
  window.scrollTo({ top:0 });
  $('vin').focus();
  $('vin').select();
}

function setLoading(loading) {
  $('research-button').disabled = loading;
  $('vin').disabled = loading;
  $('loading').hidden = !loading;
  $('lookup-form').setAttribute('aria-busy', String(loading));
}

async function startLookup() {
  if (activeRequest) return;
  const check = validateVin($('vin').value);
  $('vin').setAttribute('aria-invalid', String(!check.valid));
  if (!check.valid) { message('lookup-message', check.message); $('vin').focus(); return; }
  const controller = new AbortController();
  activeRequest = controller;
  setLoading(true);
  report = null;
  $('report').hidden = true;
  message('lookup-message', '');
  try {
    const params = new URLSearchParams({ vin:check.vin });
    const response = await fetch(`/api/research?${params}`, { signal:AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Lookup failed. Please retry.');
    if (activeRequest !== controller) return;
    report = data;
    renderReport();
    $('search-view').hidden = true;
    window.scrollTo({ top:0 });
    $('vehicle-title').focus({ preventScroll:true });
  } catch (error) {
    if (activeRequest !== controller) return;
    message('lookup-message', error.name === 'TimeoutError' ? 'The lookup timed out. Try again in a moment.' : error.message);
  } finally {
    if (activeRequest === controller) { activeRequest = null; setLoading(false); }
  }
}

function renderReport() {
  $('report').hidden = false;
  const v = report.vehicle;
  message('vehicle-title', [v.ModelYear,v.Make,v.Model].filter(Boolean).join(' ') || 'Vehicle identity incomplete');
  $('report-meta').innerHTML = `<div><span>Vehicle identification number</span><code>${escape(report.vin)}</code></div><div><span>Retrieved</span><time datetime="${escape(report.checkedAt)}">${escape(stamp(report.checkedAt))}</time></div>`;
  message('export-message', '');
  $('warnings').innerHTML = report.warnings.map(w => `<div class="notice">${escape(w)}</div>`).join('');
  const specs = [['Body',v.BodyClass],['Trim / series',v.Trim || v.Series],['Engine',v.EngineModel || (v.EngineCylinders ? `${v.EngineCylinders} cylinders` : '')],['Fuel',v.FuelTypePrimary],['Drive',v.DriveType],['Transmission',v.TransmissionStyle],['Assembly country',v.PlantCountry],['Model year',v.ModelYear]];
  $('specs').innerHTML = specs.map(([label,value]) => `<div><dt>${label}</dt><dd>${escape(value || 'Not supplied')}</dd></div>`).join('');
  $('decode-source').innerHTML = sourceLink(report.decode);
  const coverage = [['VIN identity','Retrieved'],['Model recall campaigns',statusText(report.recalls.status)],['Model owner complaints',statusText(report.complaints.status)],['Crash-test ratings',statusText(report.ratings.status)],['EPA fuel economy',statusText(report.fuel.status)],['VIN-specific open recalls','Not checked'],['Title / salvage / theft','Not checked'],['Service history','Not available']];
  $('coverage').innerHTML = coverage.map(([label,status]) => `<li><span>${label}</span><span class="status ${status === 'Retrieved' ? '' : 'unknown'}">${status}</span></li>`).join('');
  const records = [];
  if (report.recalls.count !== null) records.push(`${fmt(report.recalls.count)} recall campaigns`);
  if (report.complaints.count !== null) records.push(`${fmt(report.complaints.count)} owner complaint records`);
  message('report-summary', records.length ? `Found ${records.join(' and ')} for this model. VIN-specific history and recall repair status still need checking.` : 'Vehicle details retrieved. Safety records could not be retrieved; their status is unknown.');
  document.querySelectorAll('#report details').forEach(detail => { detail.open = false; });
  renderSafety();
  renderEnrichment();
  message('history-vin', report.vin);
  message('copy-message','');
  $('carfax-link').href = `https://www.carfax.com/vehicle-history-reports/?vin=${encodeURIComponent(report.vin)}`;
}

function renderSafety() {
  const r = report.recalls;
  message('recall-title', r.count === null ? 'Unavailable' : fmt(r.count));
  $('recall-source').innerHTML = sourceLink(r);
  $('recalls').innerHTML = r.error ? `<p class="notice">${escape(r.error)} No conclusion about recall status can be drawn.</p>` : r.records.length ? r.records.map(item => `<details class="record"><summary>${escape(item.Component)}<span class="small">${escape(item.NHTSACampaignNumber)} · Reported ${escape(item.ReportReceivedDate)}</span></summary><p><strong>Summary</strong><br>${escape(item.Summary)}</p><p><strong>Consequence</strong><br>${escape(item.Consequence)}</p><p><strong>Remedy</strong><br>${escape(item.Remedy)}</p><a href="https://www.nhtsa.gov/recalls?nhtsaId=${encodeURIComponent(item.NHTSACampaignNumber)}" target="_blank" rel="noopener noreferrer">View campaign at NHTSA ↗</a></details>`).join('') : '<p class="small">The source returned no model recall matches. This does not confirm that this VIN has no unrepaired recalls.</p>';
  const c = report.complaints;
  message('complaint-title', c.count === null ? 'Unavailable' : fmt(c.count));
  $('complaint-source').innerHTML = sourceLink(c);
  $('complaints').innerHTML = c.error ? `<p class="notice">${escape(c.error)} Complaint coverage is unknown.</p>` : c.records.length ? `<p class="small">Showing ${c.records.length} of ${fmt(c.count)} returned records, in source order. Similar reports may describe the same issue.</p><div>${c.records.map(item => `<details class="record"><summary>${escape(item.components || 'Component not supplied')}<span class="small">ODI ${escape(item.odiNumber || 'not supplied')} · Filed ${escape(item.dateComplaintFiled || 'date not supplied')}</span></summary><p>${escape(item.summary || 'No narrative supplied.')}</p></details>`).join('')}</div>` : '<p class="small">No complaint matches were returned. Absence of complaints does not establish reliability.</p>';
}

$('lookup-form').addEventListener('submit', event => { event.preventDefault(); startLookup(); });
$('print-button').addEventListener('click', () => window.print());

// Browser print (including Ctrl+P) must include every retrieved narrative.
let printState = null;
window.addEventListener('beforeprint', () => {
  if ($('report').hidden || printState) return;
  printState = { title:document.title, details:[...$('report').querySelectorAll('details')].map(node => [node,node.open]) };
  printState.details.forEach(([node]) => { node.open = true; });
  document.title = `Vehicle report - ${report.vin}`;
});
window.addEventListener('afterprint', () => {
  if (!printState) return;
  printState.details.forEach(([node,open]) => { node.open = open; });
  document.title = printState.title;
  printState = null;
});

$('export-button').addEventListener('click', async () => {
  if (!report) return;
  const vin = report.vin;
  const title = $('vehicle-title').textContent;
  const snapshot = document.querySelector('.report-document').cloneNode(true);
  snapshot.querySelectorAll('details').forEach(node => { node.open = true; });
  snapshot.querySelectorAll('button, [role="status"]').forEach(node => node.remove());
  $('export-button').disabled = true;
  message('export-message', 'Preparing your report…');
  try {
    const response = await fetch('/styles.css', { signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Styles unavailable');
    const css = await response.text();
    const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>${escape(title)} · ${escape(vin)}</title><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body class="exported-report"><main><article class="report" aria-labelledby="vehicle-title">${snapshot.outerHTML}</article></main></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type:'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `vehicle-report-${vin}.html`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('export-message', 'HTML report saved with all retrieved records. It opens offline and is ready to print.');
  } catch {
    message('export-message', 'Could not save the HTML report. Please retry, or use Print / Save PDF.');
  } finally { $('export-button').disabled = false; }
});

$('new-search').addEventListener('click', showSearch);
$('vin').addEventListener('input', () => {
  $('vin-count').textContent = `${$('vin').value.trim().length} / 17`;
  $('vin').removeAttribute('aria-invalid');
  message('lookup-message', '');
});
$('cancel-button').addEventListener('click', () => {
  const request = activeRequest;
  activeRequest = null;
  request?.abort();
  setLoading(false);
  message('lookup-message', '');
  $('vin').focus();
});

const stars = value => value === null ? 'Not rated' : `${value} / 5`;
const mpg = value => value === null ? '—' : fmt(value);
const ratingSummary = ratings => {
  const labels={overall:'Overall',front:'Front',side:'Side',rollover:'Rollover',frontDriver:'Front driver',frontPassenger:'Front passenger'};
  const available=Object.entries(ratings).filter(([,value])=>value!==null);
  return available.length ? available.map(([key,value])=>`${labels[key]} ${stars(value)}`).join(' · ') : 'No star ratings supplied for this variant';
};
function renderEnrichment() {
  const fuel=report.fuel;
  message('fuel-status',statusText(fuel.status));
  $('fuel-source').innerHTML=sourceLink(fuel);
  const fuelNote=fuel.error || fuel.note;
  $('fuel-records').innerHTML=(fuelNote ? `<p class="${fuel.error ? 'notice' : 'small'}">${escape(fuelNote)}</p>` : '') + (fuel.truncated ? '<p class="small">Showing at most 12 configurations from up to 4 matching model names. This list is not exhaustive.</p>' : '') + (fuel.records.length ? `<p class="small">${fuel.records.length} of ${fuel.count} discovered configurations retrieved. Model configuration matches only.</p>${fuel.records.map(item=>`<details class="record fuel-variant"><summary>${escape(item.model)} · ${escape(item.description)}<span class="small">${item.measures.map(m=>`${escape(m.fuel)}: ${mpg(m.city)} city / ${mpg(m.highway)} highway / ${mpg(m.combined)} combined ${escape(m.unit)}`).join('<br>')}</span></summary><dl class="specs"><div><dt>Engine / motor</dt><dd>${escape(item.engine)}</dd></div><div><dt>Transmission</dt><dd>${escape(item.transmission)}</dd></div><div><dt>Drive</dt><dd>${escape(item.drive)}</dd></div>${item.electricRange===null ? '' : `<div><dt>EPA electric range</dt><dd>${fmt(item.electricRange)} miles</dd></div>`}${item.electricity===null ? '' : `<div><dt>Electricity use</dt><dd>${fmt(item.electricity)} kWh / 100 mi</dd></div>`}</dl><a href="${escape(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">EPA configuration ${escape(item.id)} ↗</a></details>`).join('')}` : fuel.error || fuel.note ? '' : '<p class="small">No matching configurations were returned. Fuel economy is unknown.</p>');
  const ratings=report.ratings;
  message('ratings-count',ratings.status==='available' ? `${ratings.records.length} variants` : statusText(ratings.status));
  $('ratings-source').innerHTML=sourceLink(ratings);
  $('ratings-records').innerHTML=(ratings.error || ratings.note ? `<p class="${ratings.error ? 'notice' : 'small'}">${escape(ratings.error || ratings.note)}</p>` : '') + (ratings.truncated ? '<p class="small">Only the first 12 variants are included.</p>' : '') + ratings.records.map(item=>`<details class="record"><summary>${escape(item.description)}<span class="small">${escape(ratingSummary(item.ratings))}</span></summary><dl class="specs"><div><dt>Front driver</dt><dd>${stars(item.ratings.frontDriver)}</dd></div><div><dt>Front passenger</dt><dd>${stars(item.ratings.frontPassenger)}</dd></div></dl><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">NHTSA test record ${escape(item.id)} ↗</a></details>`).join('');
  $('ratings-section').open=true;
}

$('copy-vin').addEventListener('click', async () => {
  if (!report) return;
  try { await navigator.clipboard.writeText(report.vin); message('copy-message','VIN copied. Paste it into the provider’s lookup.'); }
  catch { const selection=window.getSelection(); const range=document.createRange(); range.selectNodeContents($('history-vin')); selection.removeAllRanges(); selection.addRange(range); message('copy-message','VIN selected. Copy it using your browser or keyboard.'); }
});
