import m from 'mongoose';
import softDelete from 'mongoose-delete';

const userSchema = new m.Schema({
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

export default m.model('User', userSchema);