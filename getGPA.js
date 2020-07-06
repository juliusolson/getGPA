'use-strict'

/*
	Uses Puppeteer for scraping GPA information from ladok
	Author: Julius Olson (github.com/juliusolson)
*/

const puppeteer = require('puppeteer');
const prompt = require("prompt-sync")();

async function navigate(username, password){
	/*
		Browser setup
	*/

	const b = await puppeteer.launch({
		headless: true,
		defaultViewport:null,
		devtools: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox'],
	});

	/*
		Setup page
	*/
	const page = await b.newPage();
	await page.setRequestInterception(true);
	page.on('request', (req) => {
		if (req.resourceType() == 'stylesheet' || req.resourceType() == 'font' || req.resourceType() == 'image') {
			req.abort();
		}
		else {
			req.continue();
		}
	});

	/*
		Login
	*/
	console.log("Logging in ...")
	await page.goto("https://login.kth.se/login?service=https%3A%2F%2Fwww.kth.se%2Fsocial%2Faccounts%2Flogin%2F%3Fnext%3Dhttps%253A%252F%252Fwww.kth.se%252F");
	await page.type('#username', username);
	await page.type('#password', password);
	const btn = await page.$(".btn-submit")
	await btn.click();

	/*
		Menu choices
	*/
	console.log("Navigating...")
	await page.waitForSelector(".top-mi");
	const menu = await page.$$(".top-mi");
	await menu[5].click();
	await page.waitForSelector("#menu-panel a");
	const link = await page.$$("#menu-panel a");
	await link[3].click();
	
	/*
		Scrape courses
	*/
	console.log("Scraping...")
	await page.waitForSelector("ladok-avslutad-kurs");
	const courses = await page.$$("ladok-avslutad-kurs");
	coursesText = [];
	console.log("Here");
	for (let c of courses) {
		let text = await page.evaluate(el => el.innerText, c);
		coursesText.push(text);
	}
	b.close();
	return coursesText;
}

/*
	Parse the plain text with regex
*/
function parseCourses(courses) {
	return courses.filter(course => course.split("|").length >= 5).map(course => {
		course = course.split("|");
		let points = parseFloat(course[1].match(/\d+\.\d/)[0]);
		let name = course[0].substr(0, course[0].length - 1);
		let grade = course[4].match(/[A-Z]\(/)[0][0];
		return {name, points, grade};
	});
}

/*
	Calculate gpa
*/
function calculateGPA(grades) {
	const gradeMap = {
		"A": 5,
		"B": 4.5,
		"C": 4,
		"D": 3.5,
		"E": 3,
		"3": 3,
		"4": 4,
		"5": 5,
	}
	let og = {pointSum: 0.0, gradeSum: 0.0};

	let res = grades.reduce((acc, curr) => {
		let {name, points, grade} = curr;
		if (grade in gradeMap) {
			acc.pointSum += points;
			acc.gradeSum += gradeMap[grade]*points;
		}
		return acc;
	}, og);
	const gpa = res.gradeSum/res.pointSum;
	return gpa;
}

async function getGPA(username, password) {
	const courses = await navigate(username, password);
	const parsedCourses = parseCourses(courses);
	const gpa = calculateGPA(parsedCourses);
	return {parsedCourses, gpa};
}

(async function main () {
	console.log("Calculates weighted GPA.");
	console.log("Please type in KTH credentials\n");

	const u = prompt("Username: ");
	const p = prompt.hide("Password: ");
	const res = await getGPA(u, p);
	console.log(res);
	
})();

module.exports = getGPA;