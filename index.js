import User from './User.js';
import axios from 'axios';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import schedule from 'node-schedule';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || '', { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.once('open', () => console.log('Successfully connected to MongoDB'));

let usedOi;
 
schedule.scheduleJob('*/30 * * * *', async () => { // run every 30 minutes
	console.log(`Syncing Roster...`);

	const { data } = await axios.get('https://api.vatusa.net/v2/facility/ZAB/roster/', {
		headers: {
			'Authorization': `Basic ${process.env.VATUSA_API_JWK}`
		}
	}).catch(console.error);

	const users = await User.find({vis: false, deleted: false}).lean();

	delete data.testing;

	const vatusaObject = {};
	const zabObject = {};

	for(const v of Object.values(data)) {
		vatusaObject[v.cid] = v;
	}

	for(const v of users) {
		zabObject[v.cid] = v;
	}
	
	const localRoster = users.map(user => user.cid);
	const vatusaRoster = Object.values(data).map(user => user.cid);

	const toBeAdded = vatusaRoster.filter(cid => !localRoster.includes(cid));
	const toBeDeleted = localRoster.filter(cid => !vatusaRoster.includes(cid));

	usedOi = users.map(user => user.oi);

	const addUser = async cid => {
		const userData = vatusaObject[cid];

		const oi = generateOi(userData.fname, userData.lname);

		if(!oi) {
			console.log(`Couldn't generate operating initials for controller ${userData.fname} ${userData.lname}.`);
			if(toBeAdded.length) {
				addUser(toBeAdded.shift());
			}
		} else {
			usedOi.push(oi);

			await User.create({
				cid: userData.cid,
				fname: userData.fname,
				lname: userData.lname,
				email: null,
				rating: userData.rating,
				oi,
				broadcast: false,
				vis: false
			});

			console.log(`Added user ${userData.fname} ${userData.lname} (${userData.cid} - ${oi}).`)

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
		
		const oi = user.oi
		
		user.oi = null;
		
		await user.delete();

		console.log(`Removed user ${user.fname} ${user.lname} (${user.cid} - ${oi}).`);

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

const generateOi = (fname, lname) => {
	let oi;

	oi = `${fname.charAt(0).toUpperCase()}${lname.charAt(0).toUpperCase()}`;
	
	if(!usedOi.includes(oi)) {
		return oi;
	}
	
	oi = `${lname.charAt(0).toUpperCase()}${fname.charAt(0).toUpperCase()}`;
	
	if(!usedOi.includes(oi)) {
		return oi;
	}

	const chars = `${lname.toUpperCase()}${fname.toUpperCase()}`;

	let tries = 0;

	do {
		oi = random(chars, 2);
		tries++;
	} while(usedOi.includes(oi) || tries > 10);

	if(!usedOi.includes(oi)) {
		return oi;
	}

	tries = 0;

	do {
		oi = random('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 2);
		tries++;
	} while(usedOi.includes(oi) || tries > 10);

	if(!usedOi.includes(oi)) {
		return oi;
	}

	return false;
}

const random = (str, len) => {
	let ret = '';
	for (let i = 0; i < len; i++) {
		ret = `${ret}${str.charAt(Math.floor(Math.random() * str.length))}`;
	}
	return ret;
}