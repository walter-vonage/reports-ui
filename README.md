## How to start
1) Deploy the project and then run it once. 
    -  It will ask for the first user.
    - Define the Admin email in the ```config.js``` file It will ask for a password the first run. 

```
const data = {
    VERSION: '0.0.1',
    SERVER: process.env.VCR_INSTANCE_PUBLIC_URL,
    WEBHOOK: process.env.VCR_INSTANCE_PUBLIC_URL,
    ADMIN: 'admin@vonage.com',
}

module.exports = {
    data
}
```

    - This is the only Email able create other users.

2) Then you will have in the UI the choise to
    - Enter to URL where the REPORTS project is listening (just the root)
    - And also the Master ApiKey and Secret for the account

