module.exports={
    ensureAuthenticated: function(req, res, next){
        if (req.isAuthenticated()){
            return next();

        }
        req.flash('error-msg','Please log in to view this message');
        res.redirect('/users/login');
    }
};