var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var ejs = require("ejs");
var fs = require("fs"); //내부모듈
var oracledb = require("oracledb");
oracledb.autoCommit=true;
var conn;
var conStr = require("./lib/conStr.js");
var session = require("express-session"); //외부모듈

var multiparty = require("multiparty");
var StringManager = require("./lib/StringManager.js");
var sm = new StringManager;
var app = express();
var server = http.createServer(app);

//정적자원(html, css, js,image)에 대해서는 모두 라우팅하면 너무 많은 app.use()요청을 처리해야하므로,
//미들웨어를 통해서 처리한다. static미들웨어!!
app.use(express.static(__dirname));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.use(session({
    secret: "awefaergdrtgdfbdtyh",
    resave:false, //false권장(세션에 변화가 있을 떄만ㅇ 저장하는 옵션으로 특별한 경우가 아니라면 false를 권장)
    saveUninitialized:true
})); //세션 설정

//업로드에 대한 설정
var form = new multiparty.Form({
    autoFiles:true,
    uploadDir:__dirname+"/data", /*파일이 저장될 서버 측 경로*/
    maxFilesSize:1024*1024*5
});


//서버가 가동되면 오라클을 미리 접속해놓자!!
oracledb.getConnection(conStr,function(err,con){
    if(err){
        console.log("오라클 접속 실패");
    }
    console.log("접속성공");
    conn = con;
});


//로그인 요청처리
app.use('/login',function(request, response){
   console.log(request.body);
   var id = request.body.id;
   var pw = request.body.pw;
   console.log("로그인요청받음");

   //오라클에 존재하는 회원이면, 추후 웹사이트 접속시에 이 회원을 기억하는 효과를 내보자 --> 로그인
    //데이터베이스의 성능 향상을 위해서 바인드 변수를 사용한다.
    conn.execute("select * from admin where id=:1 and pw=:2",[id, pw],function(error,result, fields){
        if(error){
            console.log(error);
        }
        console.log(result.rows.length);
        if(result.rows.length===1){//조회 결과 , 1건이 나옴ㄴ, 록인 처리할 대상
            //이 사람이 웹 사이트 어디에서나 참조할 수 있는 session객체에 정보를 담아둔다.
            //현재 요청을 시도한 브라우저가 부여받은 session객체에 정보를 담는 과정..

            request.session.user = request.body.id;
            request.session.msg="안녕";


            //admin 페이지로 방향전환
            //클라이언트에게 지정한 url로 재접속을 명령!
            response.redirect("/admin");
        }else{
            response.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});
            response.end("<script>alert('로그인실패');history.back();</script>")
        }
    });


});

//admin 메인페이지 요청처리
app.use('/admin',function(request, response){
    fs.readFile('lib/loginCheck.ejs','utf-8',function(error,data){

        fs.readFile('admin/index.ejs','utf-8',function(error2,data2){
            response.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});
            response.end(ejs.render(data+data2,{
                id: request.session.user,
                msg: request.session.msg
            }));
        });
    });

});

//로그아웃 요청 처리
app.use('/logout',function(request, response){
    request.session.destroy(function(){
        response.writeHead(200,{"Content-Type":"text/html;charset=utf-8"});
        response.end("<script>alert('로그아웃되었습니다.');location.href='/admin/login.html';</script>")
    });
});

//파일 업로드 요청 처리
app.use('/upload',function(request, response){
    //기존의 request객체를 이용하여 업로드 분석!!
    form.parse(request,function(error,fields,files){
        console.log(fields.msg[0]);
        console.log(files);
        console.log(sm.getFilename(files.myFile[0].path))
        var msg = fields.msg[0];
        var filename= sm.getFilename(files.myFile[0].path);
        if(error){
             console.log("업로드 실패",error)
        }else{
            var sql = "insert into gallery(gallery_id, msg, filename)";
            sql+= "values(seq_gallery.nextval, :1, :2)";
            conn.execute(sql,[msg,filename],function(err,result){
                if(err){
                    console.log(err)
                }
                console.log("등록성공",result);
            })
        }

    })
});

server.listen("8888",function(){
   console.log("server가 8888포트에서 가동중");
});