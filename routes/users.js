const express=require('express');
const router =express.Router();

const bcrypt=require('bcryptjs');
const passport=require('passport');

//user model

const User=require('../models/User');

router.get('/login',(req,res) => res.render('login'));

router.get('/register',(req,res) => res.render('register'));

//Register Handle

router.post('/register', (req,res)=>{
    const {name,email,password,password2}=req.body;
    let errors =[];

    if(!name||!email||!password||!password2){
        errors.push({msg:'Passwords do not match'})
    }
    if (password!==password2){
        errors.push({msg:'passwords do not match'});
    }
    if(errors.length>0){
        res.render('register',{
            errors,
            name,
            email,
            password,
            password2
        });
    }else{
        //Validation Pass
        User.findOne({email:email})
            .then(user =>{
                if (user){
                    errors.push({msg:'Email is already registered'});
                    res.render('register',{
                        errors,
                        name,
                        email,
                        password,
                        password2
                    });
                }else{
                    const newUser=new User({
                        name,
                        email,
                        password
                    });
                 // hash password
                bcrypt.genSalt(10, (err, salt)=>
                    bcrypt.hash(newUser.password, salt, (err,hash)=>{
                        if (err) throw err;

                        newUser.password=hash;
                        newUser.save()
                            .then(user=>{
                                req.flash('success_msg', 'You are now registered');
                                res.redirect('/users/login')
                            })
                            .catch(err=>console.log(err));


                }))


                }
            })

    }
});

//login handle
router.post('/login',(req,res,next)=>{
    passport.authenticate('local', {
        successRedirect: '/dashboard',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res,next);
});

router.get('/logout',(req,res)=>{
    req.logout();
    req.flash('success_msg','You are logged out');
    res.redirect('/users/login')
});
module.exports=router;