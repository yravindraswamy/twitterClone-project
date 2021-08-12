const express = require("express");
const app = express();
app.use(express.json());

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running At http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error Message: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();

//1.USER Registration Page API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectedUserQuery = `
        SELECT * FROM user WHERE username= '${username}';
    `;
  const user = await db.get(selectedUserQuery);
  if (user === undefined) {
    //insert into user table
    if (password.length < 6) {
      response.status(400);
      response.send(`Password is too short`);
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userRegisterQuery = `
            INSERT INTO user(username,password,name,gender)
            VALUES(
                '${username}',
                '${hashedPassword}',
                '${name}',
                '${gender}'
            );
        `;
      await db.run(userRegisterQuery);
      response.status(200);
      response.send(`User created successfully`);
    }
  } else {
    //user already exists
    response.status(400);
    response.send(`User already exists`);
  }
});

//2. USER Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectedUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectedUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send(`Invalid user`);
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "Ravi");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send(`Invalid password`);
    }
  }
});

const authenticateToken = (request, response, next) => {
  const authHead = request.headers["authorization"];
  let jwtToken;
  if (authHead === undefined) {
    response.status(401);
    response.send(`Invalid JWT Token`);
  } else {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send(`Invalid JWT Token`);
  } else {
    jwt.verify(jwtToken, "Ravi", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send(`Invalid JWT Token`);
      } else {
        next();
      }
    });
  }
};

const convertDbResponseToResponseObject = (eachObject) => {
  return {
    username: eachObject["username"],
    tweet: eachObject["tweet"],
    dateTime: eachObject["date_time"],
  };
};

//3.GET USER following tweets API
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { limit } = request.query;
  const getTweetsQuery = `
        SELECT*FROM user JOIN follower ON user.user_id = follower.following_user_id
        JOIN tweet ON follower.following_user_id = tweet.user_id
        ORDER BY tweet.date_time DESC
        ;
    `;
  const dbResponse = await db.all(getTweetsQuery);
  //   response.send(dbResponse);
  response.send(
    dbResponse.map((eachObject) =>
      convertDbResponseToResponseObject(eachObject)
    )
  );
});

//4.GET user followers API
app.get("/user/following/", authenticateToken, async (request, response) => {
  const getUserFollowersQuery = `
    SELECT user.username FROM user JOIN follower ON user.user_id=follower.following_user_id;
    `;
  const dbResponse = await db.all(getUserFollowersQuery);
  response.send(dbResponse);
});

//5.GET API of user following
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getUserFollowersQuery = `
        SELECT user.name AS name FROM 
        user INNER JOIN follower
        ON user.user_id = follower.following_user_id;
    `;
  const dbResponse = await db.all(getUserFollowersQuery);
  response.send(dbResponse);
});

//11 DELETE API

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const query = `
        SELECT * FROM tweet LEFT JOIN user on tweet.user_id = user.user_id
        ;
    `;
    const dbResponse = await db.all(query);
    if (dbResponse.user_id !== null) {
      const deleteQuery = `
      DELETE FROM tweet
      WHERE tweet_id = ${tweetId};
      `;
      await db.run(deleteQuery);
      response.status(200);
      response.send(`Tweet Removed`);
    } else {
      response.status(401);
      response.send(`Invalid Request`);
    }
    //   if(dbResponse.user_id === null){
    //       response.status(401);
    //       response.send(`Invalid Access`);
    //   }else{

    //   }
  }
);

module.exports = app;
