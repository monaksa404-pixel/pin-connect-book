# Pin Connect Book

ok you are acting as full stack developer you builded job connect wbesite aswell now we making antoehr website first you only have to udnerstand all what actually to build all we need i send you all that with the images for them attached images are desing how wbesite intergface should be but not to make recxac5ly like that the aim was to send that images to get idea and make more beautifult fully aligned ui than that web search big salons how their ui is then chekc all images for each page what all to do make etc this all we need to build proeprly we are somehow cloning that iwth more better desing ui than that so act as senioer web designer aswell regarding paymnt we not using stripe or any real payment inregraiton no we doing smae way how we did for job connect hbub priehct can read that to get idea same for telgram notifcaiton etc in job connect hub we did somehting like that so what acoirndgly fit in this webste integrate where need only ### Payment flow (no Stripe / no card gateway)

1. **Apply for a job** — User pays the job **application fee** by typing an **STC recharge PIN** on the apply form (not a real online checkout).

2. **Save** — The app stores `recharge_pin`, `amount_paid` (from the job fee), and sets **`payment_status` = `pending`** in Supabase.

3. **Admin** — In **Admin → Applications**, admin sees the PIN and clicks **Approve** or **Reject** PIN. That updates `payment_status` to **`verified`** or **`rejected`** and sends the user an in-app notification.

4. **User** — On **My Applications**, they see Payment Verified / Rejected. If rejected, they can **Pay Again** with a new PIN (back to `pending`).

5. **Extra payment** — Same idea on a second track: admin enables extra fee → user submits **`extra_recharge_pin`** → status **`under_verification`** → admin approves/rejects **`extra_payment_status`**.

No money is moved inside the app; admin manually confirms the PIN is acceptable.

---

### Telegram notification flow

1. When a user submits a PIN (**new application**, **pay again**, or **extra payment**), the frontend calls the server function **`notifyTelegram`** with **PIN + amount (SAR)**.

2. On the server (Vercel), it uses **`TELEGRAM_BOT_TOKEN`** and **`TELEGRAM_CHAT_ID`** and calls Telegram’s API to post a message like: STC Recharge PIN, PIN, Amount.

3. That message goes to **your configured Telegram chat** (for your team to see/copy the PIN quickly).

4. If those env vars are **not set**, Telegram is **skipped** (app still works; payment still saves in Supabase).

Telegram is **alert only** — it does not verify payment; admin verification in the panel does that.

any how come back see images attahced for itnerface ui desing we make it more tbteer than that all  and below is full requierments ### Payment flow (no Stripe / no card gateway)

1. **Apply for a job** — User pays the job **application fee** by typing an **STC recharge PIN** on the apply form (not a real online checkout).

2. **Save** — The app stores `recharge_pin`, `amount_paid` (from the job fee), and sets **`payment_status` = `pending`** in Supabase.

3. **Admin** — In **Admin → Applications**, admin sees the PIN and clicks **Approve** or **Reject** PIN. That updates `payment_status` to **`verified`** or **`rejected`** and sends the user an in-app notification.

4. **User** — On **My Applications**, they see Payment Verified / Rejected. If rejected, they can **Pay Again** with a new PIN (back to `pending`).

5. **Extra payment** — Same idea on a second track: admin enables extra fee → user submits **`extra_recharge_pin`** → status **`under_verification`** → admin approves/rejects **`extra_payment_status`**.

No money is moved inside the app; admin manually confirms the PIN is acceptable.

---

### Telegram notification flow

1. When a user submits a PIN (**new application**, **pay again**, or **extra payment**), the frontend calls the server function **`notifyTelegram`** with **PIN + amount (SAR)**.

2. On the server (Vercel), it uses **`TELEGRAM_BOT_TOKEN`** and **`TELEGRAM_CHAT_ID`** and calls Telegram’s API to post a message like: STC Recharge PIN, PIN, Amount.

3. That message goes to **your configured Telegram chat** (for your team to see/copy the PIN quickly).

4. If those env vars are **not set**, Telegram is **skipped** (app still works; payment still saves in Supabase).

Telegram is **alert only** — it does not verify payment; admin verification in the panel does that. 


also few things to forget Half of the total amount will be required as an advance payment to book an appointment. There should be an on/off button for both payment methods, so one can be turned off while the other continues to work. Also, add an option on the admin side to mark when all appointments are full. Once all appointments are full, the user should see a message saying that there are no appointment slots available right now like appointment cancelled  appoitnment complete

so this is all requerments now what tech we using for backend etc we using supabase for database also supabase and frontend sameway like job connect hub all we did as you cant connect supabase u need keys same for telgram u need keys or if any other things key needed u make .env.example where mention all which u dont have when project complete i will add them all in env file regarding sql file to run u amke that sql file all which i run in supabas ewhen create project there in sql editor and we deploy this project ot vercel to make it lvie same way did for job conect hub so this all what i have now read all web fetch what need understand all when evrything u got let me know that you are ready to build project accoridngly if i approve u start building right now undestand all if all good ready let me know if any confusion must need ot lcear let me know accrodignly if any feature looking imposbile here or psosbie but very diffcult tell that aswell what feature if nothing that tell aswell only tell first if i approve we start buidling

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f957ea07-89bf-4ebb-a420-1e65a7fad78a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
# pin-connect-book
