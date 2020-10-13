import {m as mongoose} from 'mongoose';
import softDelete from 'mongoose-delete';

const userSchema = new mongoose.Schema({
	cid: Number,
	fname: String,
	lname: String,
	email: String,
	rating: Number,
	oi: String,
	broadcast: Boolean,
	vis: Boolean,
}, {
	timestamps: true,
});

userSchema.plugin(softDelete, {
	deletedAt: true
});

export default mongoose.model('User', userSchema);
