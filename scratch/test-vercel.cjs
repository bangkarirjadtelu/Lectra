const https = require('https');
https.get('https://digilectra.vercel.app/', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    const match = data.match(/assets\/index-[^"]*\.js/);
    if (match) {
      const jsUrl = 'https://digilectra.vercel.app/' + match[0];
      https.get(jsUrl, (res2) => {
        let jsData = '';
        res2.on('data', (chunk) => { jsData += chunk; });
        res2.on('end', () => {
          if (jsData.includes('step=999')) {
            console.log('DEPLOYED: Pagination code found in live bundle!');
          } else {
            console.log('NOT DEPLOYED: Pagination code missing!');
          }
        });
      });
    } else {
      console.log('No JS bundle found.');
    }
  });
});
