import User from './User.js';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import schedule from 'node-schedule';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || '', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => console.log('Successfully connected to MongoDB'));

let usedOperatingInitials;
 
schedule.scheduleJob('*/30 * * * *', async () => { // run every 30 minutes
	console.log(`Syncing Roster...`);
	const jwt = JSON.parse(process.env.VATUSA_API_JWT);

	const { data } = await axios.get('https://api.vatusa.net/v2/facility/ZAB/roster/', {
		headers: {
			'Authorization': `Basic ${jwt.k}`
		}
	}).catch(console.error);

	const users = await User.find({vis: false, deleted: false}).lean();

	delete data.testing;
	const vatusaRosterData = Object.values(data);

	const vatusaObject = {};
	const zabObject = {};

	for(const user of vatusaRosterData) {
		vatusaObject[user.cid] = user;
	}

	for(const user of users) {
		zabObject[user.cid] = user;
	}
	
	const localRoster = users.map(user => user.cid);
	const vatusaRoster = vatusaRosterData.map(user => user.cid);

	const toBeAdded = vatusaRoster.filter(cid => !localRoster.includes(cid));
	const toBeDeleted = localRoster.filter(cid => !vatusaRoster.includes(cid));

	usedOperatingInitials = users.map(user => user.oi);

	const addUser = async cid => {
		const userData = vatusaObject[cid];

		const operatingInitials = generateOperatingInitials(userData.fname, userData.lname);

		if(!operatingInitials) {
			console.log(`Couldn't generate operating initials for controller ${userData.fname} ${userData.lname}.`);
			if(toBeAdded.length) {
				addUser(toBeAdded.shift());
			}
		} else {
			usedOperatingInitials.push(operatingInitials);

			await User.create({
				cid: userData.cid,
				fname: userData.fname,
				lname: userData.lname,
				email: null,
				rating: userData.rating,
				oi: operatingInitials,
				broadcast: false,
				vis: false
			});

			console.log(`Added user ${userData.fname} ${userData.lname} (${userData.cid} - ${operatingInitials}).`)

			if(toBeAdded.length) {
				addUser(toBeAdded.shift());
			} else {
				console.log(`Controllers added.`);
			}
		}
	}

	console.log(`Found ${toBeAdded.length} controllers to be added.`);

	if(toBeAdded.length) {
		addUser(toBeAdded.shift());
	}

	console.log(`Found ${toBeDeleted.length} controllers to be removed.`);

	const deleteController = async cid => {
		
		const user = await User.findOne({cid});
		
		const operatingInitials = user.oi
		
		user.oi = null;
		
		await user.delete();

		console.log(`Removed user ${user.fname} ${user.lname} (${user.cid} - ${operatingInitials}).`);

		if(toBeDeleted.length) {
			deleteController(toBeDeleted.shift());
		} else {
			console.log(`Controllers removed.`);
		}
	}

	if(toBeDeleted.length) {
		deleteController(toBeDeleted.shift());
	}	

	
	console.log(`...Done!`);

});

/**
 * Generates a pair of operating initials for a new controller.
 * @param fname User's first name.
 * @param lname User's last name.
 * @return A two character set of operating initials (e.g. RA).
 */
const generateOperatingInitials = (fname, lname) => {
	let operatingInitials;
	const MAX_TRIES = 10;

	operatingInitials = `${fname.charAt(0).toUpperCase()}${lname.charAt(0).toUpperCase()}`;
	
	if(!usedOperatingInitials.includes(operatingInitials)) {
		return operatingInitials;
	}
	
	operatingInitials = `${lname.charAt(0).toUpperCase()}${fname.charAt(0).toUpperCase()}`;
	
	if(!usedOperatingInitials.includes(operatingInitials)) {
		return operatingInitials;
	}

	const chars = `${lname.toUpperCase()}${fname.toUpperCase()}`;

	let tries = 0;

	do {
		operatingInitials = random(chars, 2);
		tries++;
	} while(usedOperatingInitials.includes(operatingInitials) || tries > MAX_TRIES);

	if(!usedOperatingInitials.includes(operatingInitials)) {
		return operatingInitials;
	}

	tries = 0;

	do {
		operatingInitials = random('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2);
		tries++;
	} while(usedOperatingInitials.includes(operatingInitials) || tries > MAX_TRIES);

	if(!usedOperatingInitials.includes(operatingInitials)) {
		return operatingInitials;
	}

	return false;
}

/**
 * Selects a number of random characters from a given string.
 * @param str String of characters to select from.
 * @param len Number of characters to select.
 * @return String of selected characters.
 */
const random = (str, len) => {
	let ret = '';
	for (let i = 0; i < len; i++) {
		ret = `${ret}${str.charAt(Math.floor(Math.random() * str.length))}`;
	}
	return ret;
}
