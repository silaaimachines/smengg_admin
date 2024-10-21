module.exports = {
    async beforeCreate(event) {
      const { data } = event.params;
      const knex = strapi.db.connection;
  
      try {
        // Query the maximum job number from the servicings table
        const result = await knex('servicings').max('job_number as maxJobNumber').first();
  
        // Start from 5000 if no job number exists
        let newJobNumber = result.maxJobNumber ? parseInt(result.maxJobNumber, 10) + 1 : 5000;
        data.JobNumber = newJobNumber;
  
        // Check if the customer already exists
        const customerRecord = await knex('customers')
          .select('customer_id', 'customer_name', 'customer_number')
          .where('customer_number', data.CustomerNumber)
          .first();
  
        let customerId;
  
        if (customerRecord) {
          customerId = customerRecord.customer_id;
          data.CustomerOldOrNew = 'Existing Customer';
        } else {
          const customerMaxId = await knex('customers').max('customer_id as maxCustomerId').first();
          let newCustomerId = customerMaxId.maxCustomerId
            ? `CN${String(parseInt(customerMaxId.maxCustomerId.slice(2), 10) + 1).padStart(5, '0')}`
            : 'CN00001';
  
          await knex('customers').insert({
            customer_id: newCustomerId,
            customer_name: data.CustomerName,
            customer_number: data.CustomerNumber,
            whats_app_number: data.WhatsAppNumber,
            customer_address: data.CustomerAddress,
            customer_city: data.CustomerCity,
            pending_amount: data.PendingAmount,
          });
  
          customerId = newCustomerId;
          data.CustomerOldOrNew = 'New Customer';
        }
  
        data.CustomerID = customerId;
      } catch (error) {
        console.error('Error processing job number or customer ID:', error);
        throw new Error('Unable to process job number or customer ID');
      }
    },
  
    async beforeUpdate(event) {
      const { data, where } = event.params;
      const knex = strapi.db.connection;
    
      try {
        // Get the CustomerID from the data
        const customerId = data.CustomerID;
    
        if (!customerId) {
          throw new Error('CustomerID not found in the data object');
        }
    
        // Fetch and parse TotalAmount, Discount, PaidInCash, PaidOnline as numbers
        const totalAmount = Number(data.TotalAmount) || 0;
        const discount = Number(data.Discount) || 0;
        const paidInCash = Number(data.PaidInCash) || 0;
        const paidOnline = Number(data.PaidOnline) || 0;
    
        // Step 1: Calculate the AmountAfterDiscount for this job
        const amountAfterDiscount = totalAmount - discount;
    
        // Step 2: Calculate TotalPaymentMade for this job
        const totalPaymentMade = paidInCash + paidOnline;
    
        // Step 3: Calculate the new pending amount for this job (servicing specific)
        const newJobSpecificPendingAmount = amountAfterDiscount - totalPaymentMade;
    
        // Step 4: Fetch the previous PendingAmount for this job (before update)
        const previousServicingRecord = await knex('servicings')
          .select('pending_amount')
          .where(where)
          .first();
    
        const previousJobSpecificPendingAmount = previousServicingRecord 
          ? parseFloat(previousServicingRecord.pending_amount) || 0 
          : 0;
    
        // Step 5: Fetch the current total pending_amount from the customers table
        const customerRecord = await knex('customers')
          .select('pending_amount')
          .where('customer_id', customerId)
          .first();
    
        const currentCustomerPendingAmount = customerRecord 
          ? parseFloat(customerRecord.pending_amount) || 0 
          : 0;
    
        // Step 6: Subtract the previous job-specific pending amount from the total pending amount
        let updatedCustomerPendingAmount = currentCustomerPendingAmount - previousJobSpecificPendingAmount;
    
        // Step 7: Add the new job-specific pending amount to the customer's pending amount
        updatedCustomerPendingAmount += newJobSpecificPendingAmount;
    
        // Step 8: Update the total pending_amount in the customers table
        await knex('customers')
          .where('customer_id', customerId)
          .update({
            pending_amount: updatedCustomerPendingAmount,
          });
    
        // Step 9: Update the PendingAmount field in the current servicing job
        data.PendingAmount = newJobSpecificPendingAmount;
    
      } catch (error) {
        console.error('Error updating service details:', error);
        throw new Error('Unable to update service details');
      }
    }    
  };  