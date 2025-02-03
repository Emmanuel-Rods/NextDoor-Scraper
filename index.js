const puppeteerExtra = require("puppeteer-extra");
const Stealth = require("puppeteer-extra-plugin-stealth");
const fsPromise = require("fs").promises;
const XLSX = require('xlsx');
const fs = require('fs');
const emailCrawler = require("./Email-Crawler.js");



puppeteerExtra.use(Stealth());

const scrollDelay = 2000; // in miliseconds ,  increase if slow internet , for testing keep 1000
const pageDelay = 7000; // in miliseconds , decrease if your not afraid of getting banned
let query = "Tax Preparer";

function delay(time){
  return new Promise((resolve) => setTimeout(resolve , time))
}

function createXlsxFile(data, fileName) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, fileName);
  console.log(`XLSX file created: ${fileName}`);
}

async function run(){
  const browser = await puppeteerExtra.launch({
    headless: false,
    args: ["--force-device-scale-factor=1"],
  });
  //setting cookies
  const cookiesString = await fsPromise.readFile("./cookies.json");
  const cookies = JSON.parse(cookiesString);
  await browser.setCookie(...cookies);

  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36"
  );

  await page.goto("https://nextdoor.com/" , { waitUntil: 'domcontentloaded' , timeout : 30000 });
  // await page.waitForNetworkIdle(); // Wait for network resources to fully load

  await delay(3000)
  //search
  try {
    const searchBar = "#search-input-field";
    await page.waitForSelector(searchBar);
    await page.type(searchBar, query, { delay: 100 });

    await page.keyboard.press("Enter");

    await delay(5000);
    //click the business tab
    const businessesTab = 'a[data-testid="tab-businesses"]';
    await page.waitForSelector(businessesTab);
    await page.click(businessesTab);
    await delay(1500)
  } catch (error) {
    console.log("Error while searching :", error);
  }

  // Scroll dynamically to load all content
  const scrollPageToBottom = async () => {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, scrollDelay)); // Wait for content to load
  };

  let previousHeight = 0;
  while (true) {
    await scrollPageToBottom();
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    if (newHeight === previousHeight) break;
    previousHeight = newHeight;
  }

  // get all the deeeps
  const deepLinks = await page.$$eval(
    'div[data-v3-view-type="V3Wrapper"]',
    (divs) =>
      divs
        .map((div) => {
          const anchor = div.querySelector('a'); // Find the anchor inside the div
          return anchor ? anchor.getAttribute('href') : null; // Get href if anchor exists
        })
        .filter((href) => href && !href.startsWith('https')) // Filter out https links
  );
  

  console.log("deepLinks" , deepLinks); // Output the deep links
  let totalData = []
  for (const link of deepLinks) {
    const base = 'https://nextdoor.com'
    try {
      const newPage = await browser.newPage();
      await newPage.goto(base + link, { waitUntil: 'networkidle2' });
      await delay(2500)
      // Extract Name and Phone Number
      await newPage.waitForSelector('h2[data-testid="business-name"]', { timeout: 5000 });
      
      try{
        const data = await newPage.evaluate(() => {
          //name 
          const nameElement = document.querySelector('h2[data-testid="business-name"]');
          const name = nameElement ? nameElement.textContent.trim() : null;
          //phone number 
          const phoneButton = document.querySelector('button[data-testid="phone-button"]');
          const phoneTextElement = phoneButton ? phoneButton.querySelector('div div div div') : null;
          const phone = phoneTextElement ? phoneTextElement.textContent.trim().replace(/^Call\s*/, '').trim() : null; 
          //email 
          const emailLink = document.querySelector('a[data-testid="email-link"]');
          const email = emailLink ? emailLink.textContent.trim() : null;
          //website
          const websiteLink = document.querySelector('div > a[data-testid="website-url-link"]');
          const website = websiteLink ? websiteLink.getAttribute('href').trim() : null;
          //categories (shallow)
          const categoryElements = document.querySelectorAll('h3 a[data-testid="topic"]');
          const categories = Array.from(categoryElements).map((categoryElement) => categoryElement.textContent.trim()).join(', ');
          //latest recomendation date
          const authorDiv = document.querySelector('div[data-testid="author-children-test"]');
          const buttonDiv = authorDiv ? authorDiv.querySelector('div[role="button"]') : null;
          const commentDate = buttonDiv ? buttonDiv.textContent.trim() : null;
      
          return { name , phone , email , website , categories , commentDate}
        });
        console.log({data});
        //push the total data into a global array to later convert into xlsx
        totalData.push(data)
        await delay(pageDelay)
      }
      catch(error){
        console.log('error on link:' , link , error)
      }
      finally {
        await newPage.close();
      }
     
    } catch (error) {
      console.log('Error while visiting link:', link, '\n', error.message);
    }
  }

  //extract the emails 
 try{
     const extractedData = await emailCrawler(totalData)
  //save the data
    createXlsxFile(extractedData, `${query}.xlsx`)
  }
  catch(error){
    console.error(`Error while extracting Emails : ${error}`)
  }



  await page.screenshot({ path: "screenshot.png" });
  //save the cookies
  const newCookies = await browser.cookies();
  fsPromise.writeFile("cookies.json", JSON.stringify(newCookies, null, 2));

  await browser.close();
};

run()