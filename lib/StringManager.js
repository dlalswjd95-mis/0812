
class StringManager{

    getFilename(str){
         return str.substring(str.lastIndexOf("\\")+1,str.length);
     }
};

 module.exports= StringManager