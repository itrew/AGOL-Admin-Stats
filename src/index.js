import fetch from 'unfetch';

export default function AGOLAdminStats(portalUrl = 'https://www.arcgis.com/', token = '') {
  this.portalUrl = portalUrl;
  this.token = token;
  this.orgId = undefined;
}

AGOLAdminStats.prototype.getSelf =
  function getSelf(token = this.token) {
    return new Promise((resolve, reject) => {
      if (!token) {
        reject(new Error('Token is required.'));
      } else {
        fetch(`${this.portalUrl}/sharing/rest/community/self?token=${token}&f=json`)
          .then(res => res.json())
          .catch(err => reject(err))
          .then((json) => {
            if (!json || !json.username) throw new Error('Invalid response from /community/self.');
            this.orgId = json.orgId || undefined;
            resolve(json);
          })
          .catch(err => reject(err));
      }
    });
  };

AGOLAdminStats.prototype.getOrgId =
  function getOrgId() {
    return new Promise((resolve, reject) => {
      if (this.orgId) {
        resolve(this.orgId);
      } else {
        this.getSelf()
          .then((self) => {
            this.orgId = self.orgId;
            resolve(self.orgId);
          })
          .catch(err => reject(err));
      }
    });
  };

AGOLAdminStats.prototype.getAllUsers =
  function getAllUsers() {
    const pageSize = 100; // Max of 100
    let startIndex = 1;
    const url = `${this.portalUrl}/sharing/rest/portals/self/users?token=${this.token}&num=${pageSize}&f=json`;
    function getUserPage(start) {
      return new Promise((resolve, reject) => {
        fetch(`${url}&start=${start}`)
          .then(res => res.json())
          .catch(err => reject(err))
          .then((json) => {
            if (!json || !json.users) throw new Error('Invalid response from /portals/self/users.');
            resolve(json);
          })
          .catch(err => reject(err));
      });
    }
    return new Promise((resolve, reject) => {
      getUserPage(startIndex)
        .then((json) => {
          let { users } = json;
          if (json.nextStart > -1) {
            const pagePromises = [];
            while (startIndex <= (json.total - pageSize)) {
              startIndex += pageSize;
              pagePromises.push(getUserPage(startIndex));
            }
            Promise.all(pagePromises)
              .then((userPageArray) => {
                userPageArray.forEach((userArrayObject) => {
                  users = users.concat(userArrayObject.users);
                });
                resolve(users);
              })
              .catch(err => reject(err));
          } else {
            resolve(users);
          }
        })
        .catch(err => reject(err));
    });
  };

AGOLAdminStats.prototype.getAllGroups =
  function getAllGroups(getUsers = false) {
    const pageSize = 100; // Max of 100
    let startIndex = 1;
    const url = `${this.portalUrl}/sharing/rest/community/groups`;
    const query = `?token=${this.token}&num=${pageSize}&f=json`;
    function getGroupUsers(group) {
      const groupCopy = Object.assign({}, group);
      return new Promise((resolve, reject) => {
        fetch(`${url}/${group.id}/users${query}`)
          .then(res => res.json())
          .catch(err => reject(err))
          .then((json) => {
            if (!json || !json.users) throw new Error(`Invalid response from /community/groups/${group.id}/users.`);
            groupCopy.users = json.users;
            resolve(groupCopy);
          })
          .catch(err => reject(err));
      });
    }
    function getGroupPage(orgId, start, getUsersForGroup) {
      return new Promise((resolve, reject) => {
        fetch(`${url}${query}&q=orgid:${orgId}&start=${start}`)
          .then(res => res.json())
          .catch(err => reject(err))
          .then((json) => {
            if (!json || !json.results) throw new Error('Invalid response from /community/groups.');
            if (getUsersForGroup) {
              const groupUserPromises = [];
              json.results.forEach((group) => {
                groupUserPromises.push(getGroupUsers(group));
              });
              Promise.all(groupUserPromises)
                .then((groupsWithUsersArray) => {
                  const jsonCopy = Object.assign({}, json);
                  jsonCopy.results = groupsWithUsersArray;
                  resolve(jsonCopy);
                })
                .catch(err => reject(err));
            } else {
              resolve(json);
            }
          })
          .catch(err => reject(err));
      });
    }
    return new Promise((resolve, reject) => {
      this.getOrgId().then((orgId) => {
        getGroupPage(orgId, startIndex, getUsers)
          .then((json) => {
            let groups = json.results;
            if (json.nextStart > -1) {
              const pagePromises = [];
              while (startIndex <= (json.total - pageSize)) {
                startIndex += pageSize;
                pagePromises.push(getGroupPage(orgId, startIndex));
              }
              Promise.all(pagePromises)
                .then((groupPageArray) => {
                  groupPageArray.forEach((groupArrayObject) => {
                    groups = groups.concat(groupArrayObject.results);
                  });
                  resolve(groups);
                })
                .catch(err => reject(err));
            } else {
              resolve(groups);
            }
          })
          .catch(err => reject(err));
      }).catch(err => reject(err));
    });
  };

AGOLAdminStats.prototype.getUserGroupData =
function getUserGroupData() {
  return new Promise((resolve, reject) => {
    Promise.all([this.getAllUsers(), this.getAllGroups(true)])
      .then((results) => {
        let [users, groups] = results;
        users = users.map((user) => {
          // eslint-disable-next-line no-param-reassign
          user.groups = groups.filter(group => group.users.indexOf(user.username) > -1);
          return user;
        });
        groups = groups.map((group) => {
          // eslint-disable-next-line no-param-reassign
          group.users = group.users.map((groupUsername) => {
            const matchingUsers = users.filter(user => user.username === groupUsername);
            if (matchingUsers.length === 0) {
              return { username: groupUsername, external: true };
            }
            return matchingUsers[0];
          });
          return group;
        });
        this.users = users;
        this.groups = groups;
        resolve({ users, groups });
      })
      .catch(err => reject(err));
  });
};
