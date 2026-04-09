#!/bin/bash
printf '%s\n' '-----BEGIN OPENSSH PRIVATE KEY-----' 'b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jYmMAAAAGYmNyeXB0AAAAGAAAABC4FJu6HO' 'IBmeejKg4U3eXiAAAAZAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIAFWTlSMwB+9PaH2' 'Yo6A0xtHE7Mcqm0qCe4ZVF/oQQ6yAAAAoEtcy+NQqzkJbUWMfKuZ8DYKfxBEP3vNHiTLvo' 'JK4FIIM2dGRK8srbqpkpxA7waDXR0A/AdZdwvnhOlcVyqUS6EtQIsmN6+sfbHDJ7Bqa+QF' 'OuD1zAooK7BguZBJzzqKGApcdTtbp3hrmpEZBuTFD9gsPXEH7KUAfHuN6+mrmXvUyXBXWT' 'VrXqcmsNUX5eqiTt1Lj1hdc41bxfIr4B/jlCk=' '-----END OPENSSH PRIVATE KEY-----' > ~/.ssh/id_experiment
chmod 600 ~/.ssh/id_experiment
echo "Key installed. Now run:"
echo "ssh -i ~/.ssh/id_experiment root@89.167.77.26 -t tmux -CC attach -t commercial-ops"
echo "Passphrase: Ationifi20!"
