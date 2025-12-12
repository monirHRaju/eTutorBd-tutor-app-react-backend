const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// stripe
const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;
// const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString(
//   'utf-8'
// )
// const serviceAccount = JSON.parse(decoded)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
    optionSuccessStatus: 200,
  })
);
app.use(express.json());

// jwt middlewares
const verifyJWT = async (req, res, next) => {
  const token = req?.headers?.authorization?.split(" ")[1];
  console.log(token);
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.tokenEmail = decoded.email;
    console.log(decoded);
    next();
  } catch (err) {
    console.log(err);
    return res.status(401).send({ message: "Unauthorized Access!", err });
  }
};

// Create a MongoClient with a MongoClientOptions object to set the Stable API version

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // database and collections
    const eTutorBd_db = client.db("eTutorBd_db");
    const userCollection = eTutorBd_db.collection("users");
    const tuitionCollection = eTutorBd_db.collection("tuitions");
    const applicationCollection = eTutorBd_db.collection("applications");

    // user related apis

    // post user
    // app.post('/users', async (req, res) => {
    //   const userData = req.body
    //   userData.created_at = new Date().toISOString()
    //   userData.last_loggedIn = new Date().toISOString()

    //   if(!userData.role) {
    //     userData.role = 'student'
    //   }

    //   console.log(userData)

    //   const query = {
    //     email: userData.email
    //   }

    //   const alreadyExists = await usersCollection.findOne(query)
    //   console.log('User Already Exists---> ', !!alreadyExists)

    //   if (alreadyExists) {
    //     console.log('Updating user info......')
    //     const result = await usersCollection.updateOne(query, {
    //       $set: {
    //         last_loggedIn: new Date().toISOString(),
    //       },
    //     })
    //     return res.send(result)
    //   }

    //   console.log('Saving new user info......')
    //   const userInsertResult = await usersCollection.insertOne(userData)

    //   res.send(userInsertResult)
    // })

    app.post("/users", async (req, res) => {
      const userData = req.body;
      // user.role = 'user';
      userData.createdAt = new Date().toLocaleDateString();
      userData.status = "pending";
      const query = {
        email: userData.email,
      };
      const userExists = await userCollection.findOne(query);

      if (userExists) {
        return res.status(401).send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(userData);
      res.send(result);
    });

    //get all users
    app.get("/users", async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/user", async (req, res) => {
      const email = req.body;
      const query = {};
      query.email = email;

      const user = await userCollection.findOne(query);

      res.send(user);
    });

    app.delete("/users/:userId/delete", async (req, res) => {
      const userId = req.params.userId;
      const query = { _id: new ObjectId(userId) };

      const result = await userCollection.deleteOne(query);

      res.send(result);
    });


    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      // console.log(result)
      res.send({ role: user?.role });
    });

    app.get("/tutor-info/:email/email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      // console.log(result)
      res.send({ role: user?.role });
    });

    app.patch("/users/:id", async (req, res) => {
      const role = req.body.role;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.patch("/users/:id/status", async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    //tuitions related apis
    app.post("/tuitions", async (req, res) => {
      const tuitionData = req.body;
      tuitionData.createdAt = new Date().toLocaleString();

      const result = await tuitionCollection.insertOne(tuitionData);

      res.send(result);
    });

    app.patch("/tuitions/:tuitionId/status", async (req, res) => {
      const status = req.body.status;
      const tuitionId = req.params.tuitionId;
      const query = { _id: new ObjectId(tuitionId) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await tuitionCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.delete("/tuitions/:tuitionId/delete", async (req, res) => {
      const tuitionId = req.params.tuitionId;
      const query = { _id: new ObjectId(tuitionId) };

      const result = await tuitionCollection.deleteOne(query);

      res.send(result);
    });

    app.get("/not-enrolled-accepted-tuitions", async (req, res) => {
      const query = {
        status: "accepted",
        tutorEnrolled: { $ne: true }

      };
      const result = await tuitionCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });
    
    app.get("/not-enrolled-accepted-latest-tuitions", async (req, res) => {
      const query = {
        status: "accepted",
        tutorEnrolled: { $ne: true }

      };
      const result = await tuitionCollection
        .find(query)
        .limit(8)
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });

    app.get("/all-tuitions", async (req, res) => {
      const result = await tuitionCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      // console.log(result)
      res.send(result);
    });

    app.get("/tuitions/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await tuitionCollection.findOne(query);
      res.send(result);
    });

    app.get("/tuitions/:email/student", async (req, res) => {
      const email = req.params.email;
      const query = { studentEmail: email, tutorEnrolled: { $ne: true } };

      const result = await tuitionCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    //application related apis
    app.post("/applications", async (req, res) => {
      const applicationInfo = req.body;
      applicationInfo.createdAt = new Date().toLocaleString();

      const result = await applicationCollection.insertOne(applicationInfo);

      res.send(result);
    });

    app.get("/applications/:tuitionId", async (req, res) => {
      const tuitionId = req.params.tuitionId;
      const query = { tuitionId: tuitionId };

      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/applications/:email/student", async (req, res) => {
      const email = req.params.email;
      const query = {
        studentEmail: email,
      };
      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.get("/applications/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        tutorEmail: email,
      };
      const result = await applicationCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    app.patch("/applications/:id/status", async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: status,
        },
      };
      const result = await applicationCollection.updateOne(query, updateDoc);

      res.send(result);
    });

    app.patch("/applications/:id/delete", async (req, res) => {
      const applicationId = req.params.id;
      const query = { _id: new ObjectId(applicationId) };

      const result = await applicationCollection.deleteOne(query);

      res.send(result);
    });

    // stripe payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body
      
      const amount = parseInt(paymentInfo.offerPrice) * 100
      console.log({paymentInfo, amount})
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency : 'USD',
              unit_amount : amount,
              product_data: {
                name: paymentInfo.subject,
              }
            },
            quantity: 1,
          },
        ],
        customer_email : paymentInfo.tutorEmail,
        mode: "payment",
        metadata: {
          tuitionId : paymentInfo.tuitionId,
          budget : paymentInfo.budget,
          studentName : paymentInfo.studentName,
          tutorEmail : paymentInfo.tutorEmail
        },
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`
      });

      // res.redirect(303, session.url);
      console.log(session)
      res.send({url : session.url})
      
    })

    // update after successful payment
    app.patch('/verify-payment-success', async(req, res) => {
      const sessionId = req.query.session_id

      const session = await stripe.checkout.sessions.retrieve(sessionId)
      // data to send frontend
      const amountTotal = session.amount_total/100
      const transactionId = session.payment_intent
      const tutorEmail = session.metadata.tutorEmail

      

      console.log('session retrieve', session)
      if(session.payment_status === 'paid'){
        const tuitionId = session.metadata.tuitionId
        
        // reject all applications for a tuition
        const applicationQuery = {tuitionId : tuitionId}
        const rejectedApplicationUpdate = {
          $set : {
            status : 'rejected'
          }
        }
        const rejectedTuitions = await applicationCollection.updateMany(applicationQuery, rejectedApplicationUpdate)
        console.log('rejected',rejectedTuitions);
        const acceptQuey = {
          tuitionId : tuitionId,
          tutorEmail : session.metadata.tutorEmail
        }
        const enrolledApplicationUpdate = {
          $set : {
            status : 'enrolled'
          }
        }
        const enrolledTuition = await applicationCollection.updateOne(acceptQuey, enrolledApplicationUpdate)
        console.log('enrolled', enrolledTuition);

        //accept one from rejected list
        const query = {_id : new ObjectId(tuitionId)}
        const update =  {
          $set : {
            tutorEnrolled : true,
            tutorEmail : session.metadata.tutorEmail
          }
        }
        const tuitionUpdateResult = await tuitionCollection.updateOne(query, update)

        console.log('tuition enrolled update:', tuitionUpdateResult)
        const matchedCount = tuitionUpdateResult.matchedCount

        const paymentData = {amountTotal, transactionId, tutorEmail, matchedCount}
        return res.send(paymentData)
      }

      res.send({success : false})
    })


    // tutor related apis
    app.get("/tutors", async (req, res) => {
      const query = {
        role: "tutor",
        status : "accepted"
      };
      const cursor = userCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();

      res.send(result);
    });
  
  } finally {
    // Ensures that the client will close when you finish/error
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from Server..");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
})
