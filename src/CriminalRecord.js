export default class CriminalRecord {
  cabinet = [];

  /**
   * Determine if we have a record on the suspect-lead connection. This way
   * we can avoid redundant prosecution.
   * @param {string} suspect - Suspect source path
   * @param {string} lead - Lead path provided by suspect
   * @returns {boolean} True if we have a record in the cabinet
   */
  has (suspect, ...leads) {
    return this.cabinet.some((record) => {
      return record[0] === suspect && record[1] === leads.join(':');
    });
  }

  /**
   * Record the suspect lead connection
   * @param {string} suspect - Suspect source path
   * @param {string} lead - Lead path provided by suspect
   * @returns {criminalrecord} Returns reference to self to be chainable
   */
  store (suspect, ...leads) {
    this.cabinet.push([suspect, leads.join(':')]);
    return this;
  }
}
