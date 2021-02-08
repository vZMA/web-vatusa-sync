import mongoose from 'mongoose';
import softDelete from 'mongoose-delete';

const userSchema = new mongoose.Schema({
	cid: Number,
	fname: String,
	lname: String,
	email: String,
	rating: Number,
	oi: String,
	broadcast: Boolean,
	member: Boolean,
	vis: Boolean,
	discordInfo: {
		clientId: String,
		accessToken: String,
		refreshToken: String,
		tokenType: String,
		expires: Date,
	},
	roles: Array,
	certifications: Array,
	trainingMilestones: Array
}, {
	timestamps: true,
});

userSchema.plugin(softDelete, {
	deletedAt: true
});

export default mongoose.model('User', userSchema);
