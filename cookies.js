const puppeteerExtra = require("puppeteer-extra");
const Stealth = require("puppeteer-extra-plugin-stealth");
require("dotenv").config();
const fs = require('fs').promises


puppeteerExtra.use(Stealth());

function delay(time){
    return new Promise((resolve) => setTimeout(resolve , time))
}

async function login() {
  //check if credentials are present 
  if(process.env.EMAIL_ADDRESS == '' || process.env.EMAIL_ADDRESS == ''){
    throw new Error('Crendentials Empty , EMAIL and PASSWORD are Required')
  }
  const browserObj = await puppeteerExtra.launch({ headless: false });
  const page = await browserObj.newPage();

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
  );

  await page.goto("https://nextdoor.com/login/");
  await page.waitForNetworkIdle(); // Wait for network resources to fully load

  //log in
  try {
    const emailbox = "#id_email";
    await page.waitForSelector(emailbox);
    await page.type(emailbox, process.env.EMAIL_ADDRESS, { delay: 100 });

    const passwordBox = "#id_password";
    await page.waitForSelector(passwordBox);
    await page.type(passwordBox, process.env.PASSWORD, { delay: 100 });
    
    const loginBtn = await page.$('button[type="submit"]');
    await loginBtn.click()

    await delay(60000)
    const cookies = await browserObj.cookies()
    fs.writeFile('cookies.json' , JSON.stringify(cookies, null, 2))
    
  } catch (error) {
    console.log("Error while Loggin in :", error);
  }

  await page.screenshot({ path: "screenshot.png" });

  await browserObj.close();
}

login();
